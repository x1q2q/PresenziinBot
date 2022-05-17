const { Telegraf, Scenes, session, Stage, WizardScene } = require('telegraf');
const { absensiBerlangsung, absensiMakul, absenkan,
   authLogin, pertemuan, rekapAbsen, registerMakul } = require('./menuController');
const { b64, timestamp, convertTZ, utils} = require('./utils/myUtils');
const MongoDB = require('./utils/mongoUtil');
const date = require('date-and-time');
const CFonts = require('cfonts');

require('dotenv').config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const cleanup = (event) => { // SIGINT is sent for example when you Ctrl+C a running process from the command line.
  if(MongoDB.checkDB() != undefined){
    MongoDB.disconnectDB(); // Close MongodDB Connection when Process ends
  }
}
MongoDB.connectDB(async (err) => {
  if (err) ctx.reply('error!\ncant connect to database');
  bot.start(async(ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    let message = "";
    if(isExistID){
      message = '<b>Hi '+ctx.from.first_name+'</b>, anda sudah terdaftar pada '+
              'tools bot presenzi ini. \n\n<i>Silakan gunakan tools ini dengan bijak,'+
              ' masuk ke /menuutama agar bisa melihat perintah yang bisa digunakan </i>😊';
    }else{
      message = '<b>Hello ' +ctx.from.first_name+'\n\nWelcome to PresenziinBotv1!</b>\n'+
              '<i>"Bot ini digunakan untuk membantu mpresenziin absenanmu lurr!"</i>'+
              '\nSilakan memmulai dengan memilih:\n/menuutama';
    }
      ctx.reply(message,{parse_mode:'HTML'});
  })

  bot.command('menuutama',async(ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    let message = "<b>[MENU UTAMA]</b>\n\n";
    if(isExistID){
      var isMaintainer = (userID === process.env.MAINTAINER.toString());
      message += '<b>Absensi</b>\n/login - regenerate session akun'+
      '\n/gasabsen - gas absensi berlangsung'+
      '\n/absenmakul - cek absen per-makul'+
      '\n/rekapabsen - cek statistik absen\n\n'+
      '<b>Profile</b>\n/showprofile - tampil profil akun'+
      '\n/editprofile - edit profil akun'+
      '\n/editlocation - edit lokasi absen'+
      '\n/logout - hapus session akun'+
      '\n\n<b>Extra</b>\n/mygroupmk - group makul terdaftar'+
      '\n/registermk - daftarkan makul ke group'+
      '\n/removemk - hapus makul di group';
      if(isMaintainer){
        message += '\n\n<b>Maintainer</b>\n/ngumumin - ngumumin pesan siaran'+
        '\n/listusers - lihat data pengguna'+
        '\n/listcodes - lihat data secret code'+
        '\n/bacalogs - lihat data log';
      }
    }else{
      message += '<b>Profile</b>\n/gasdaftar - tancap gas buat daftar\n\n'+
      '<pre>"Anda bisa menggunakan tools absen ketika sudah mendaftar"</pre>';
    }
    await ctx.reply(message,{parse_mode:'HTML'});
    console.log(ctx.from.first_name+' mengecek menuutama');
  })

  bot.command('login', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isExpired = await utils.checkExpired(userID);
      if(isExpired){
        await ctx.reply("<b>Maaf akun anda telah expired :(</b>\nAnda tidak bisa menggunakan perintah ini lagi",
              {parse_mode:'HTML'});
      }else{
        const newUser = await MongoDB.getCollection('users');
        var userProfile = await newUser.find({userid:userID}).toArray();
        if(userProfile[0]["cookie"] != "-"){ // ada cookie login, hapus dahulu
          await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
        }
        const isLogin = await authLogin(ctx);
        if(isLogin === true){
          await ctx.reply("Silakan masuk ke /menuutama & lanjutkan perintah yang anda inginkan :)");
        }
      }
    }
  })


  bot.command('gasabsen', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isExpired = await utils.checkExpired(userID);
      if(isExpired){
        await ctx.reply("<b>Maaf akun anda telah expired :(</b>\nAnda tidak bisa menggunakan perintah ini lagi",
              {parse_mode:'HTML'});
      }else{
        const data = await absensiBerlangsung(ctx);
        if(data.length > 0){
          const filterPresenzi = (id) => data.filter(f => f["id"] == id);
          const dtTxtId = data.map(el => el["id"]);
          const textPertemuan = data.map(el => "<b>"+el["no"]+".) "+el["makul"]+"</b> - ("+el["pertemuan"]+")");
          const filterPertemuan = data.map(val =>
                ({'id':val.id,'message':"<b>- "+val.makul+"</b> - ("+val.pertemuan+")"}));

          let strDtPertemuan = "<b>═✪ List Presenzi Berlangsung ✪═</b>\n\n";
          await ctx.reply(strDtPertemuan+textPertemuan.join('\n\n'),{parse_mode:'HTML'});

          if(data.length == 1){
            let filterById = filterPresenzi(dtTxtId[0]); // auto absenkan jika 1 length
            let pertemuan = "Nomor("+filterById[0]["no"]+")";
            await ctx.reply('Anda memilih presensi <b>'+pertemuan+'</b>',{parse_mode:'HTML'});
            var dtNim = await utils.getDataNim(filterById[0]["slugmakul"],userID);

            const newFilterPertemuan = filterById.map(el => el["message"]);
            const broadcastParams = {
              "dataPenerima": dtNim,
              "parameter": "nim",
              "textMsg": "Sudah ada absensi untuk: \n"+newFilterPertemuan.join('\n')
            };
            const resp = await absenkan(dtTxtId[0],broadcastParams.textMsg,ctx);
            if(resp){
              let isExistIdAbsen = await utils.checkExistIdAbsen(dtTxtId[0]);
              if(!isExistIdAbsen){
                // for broadcast after absen
                var dataBroadcast = await utils.sendBroadcast(broadcastParams);
                for(var bc = 0; bc<dataBroadcast.length; bc++){
                  // console.log(dataBroadcast[bc]["userid"]+' '+dataBroadcast[bc]["pesan"]);
                  bot.telegram.sendMessage(dataBroadcast[bc]["userid"],dataBroadcast[bc]["pesan"],{parse_mode:'HTML'});
                }
              }
            }
          }else{ // data.length > 1 data presensi
             var options = {
               reply_markup: JSON.stringify({
                 inline_keyboard: data.map((x, xi) => ([{
                   text: "Nomor("+x["no"]+")",
                   callback_data: x["id"],
                 }])),
               }),
             };
             await bot.telegram.sendMessage(ctx.chat.id, 'Silakan pilih nomor presenzi',options);
             await bot.action(dtTxtId, async (ctx) => {
               await ctx.editMessageReplyMarkup({
                 reply_markup: { remove_keyboard: true },
               })
               let txtId = ctx.match[0];
               let filterNo = filterPresenzi(txtId);
               let pertemuan = "Nomor("+filterNo[0]["no"]+")";
               await ctx.editMessageText('Anda memilih presensi <b>'+pertemuan+'</b>',{parse_mode:'HTML'});
               var splitTextId = txtId.split(',');
               for(var j =0 ; j<splitTextId.length; j++){
                  let filterById = filterPresenzi(splitTextId[j]);
                  let filterMakul =  filterById[0]["slugmakul"];
                  await ctx.reply(`(${(j+1)}/${(splitTextId.length)}) Mengabsenkan <b>${filterById[0]["message"]}</b>`,{parse_mode:'HTML'});
                  const newFilterPertemuan = filterById.map(el => el["message"]);
                   var dtNim = await utils.getDataNim(filterMakul,userID);
                   const broadcastParams = {
                     "dataPenerima": dtNim,
                     "parameter": "nim",
                     "textMsg": "Sudah ada absensi untuk: \n"+newFilterPertemuan.join('\n')
                   };
                   await absenkan(splitTextId[j],broadcastParams.textMsg,ctx).then(async resp => {
                     if(resp){
                       let isExistIdAbsen = await utils.checkExistIdAbsen(splitTextId[j]);
                       if(!isExistIdAbsen){
                         // for broadcast after absen
                         var dataBroadcast = await utils.sendBroadcast(broadcastParams);
                         for(var bc = 0; bc<dataBroadcast.length; bc++){
                           // console.log(dataBroadcast[bc]["userid"]+' '+dataBroadcast[bc]["pesan"]);
                           bot.telegram.sendMessage(dataBroadcast[bc]["userid"],dataBroadcast[bc]["pesan"],{parse_mode:'HTML'});
                         }
                       }
                       return ctx.answerCbQuery("Berhasil absen!");
                     }else{
                       return ctx.answerCbQuery("Gagal absen!");
                     }
                   });
                 }

             });
          }
        }
        let params = {
          "tipe_log":"check_menu",
          "kode_log":"gasabsen",
          "desc":`${ctx.from.first_name} mengecek menu gasabsen`
        };
        const saveLog = await utils.saveToLog(params,userID);
      }
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  bot.command('absenmakul', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isExpired = await utils.checkExpired(userID);
      if(isExpired){
        await ctx.reply("<b>Maaf akun anda telah expired :(</b>\nAnda tidak bisa menggunakan perintah ini lagi",
              {parse_mode:'HTML'});
      }else{
        const data = await absensiMakul(ctx);
        if(data.length > 0){
          const dtNo = data.map(el => userID+'-'+el["no"].toString());
          const txtMakul = data.map(el => "<b>"+el["no"]+".)  ​​📗​"+el["nama_mk"]+"</b> ["+el["kelas"]+"]  - 👨‍💼("+el["pengampu"]+")");
          let strDatamk = "<b>═══✪ List All Matakuliah ✪═══</b>\n\n";
          await ctx.reply(strDatamk+txtMakul.join('\n\n'),{parse_mode:'HTML'});
          var arrMakul = data.map((el,id) => (
            {text:"Nomor ("+el["no"]+")",callback_data:userID+'-'+el["no"].toString()}
          ));
          let dtSplit = await utils.splitArray(arrMakul,3);
          var options = {
            reply_markup: {
              inline_keyboard: dtSplit
            },
          };
          await bot.telegram.sendMessage(ctx.chat.id, 'Silakan pilih nomor makul',options);
          await bot.action(dtNo, async (ctx) => {
            ctx.editMessageReplyMarkup({
              chat_id:ctx.chat.id,
              message_id:ctx.chat.id,
              reply_markup: { remove_keyboard: true },
            }).catch(function(err){console.log('error cok '+err)});
            let noPilih = ctx.match[0].split('-');
            if(noPilih[0] === userID){ // menghindari error
              let filterMakul = data.filter(el => el["no"] == noPilih[1]);
              let makul = "Nomor ("+filterMakul[0]["no"]+")";
              let link = filterMakul[0]["link"];
              let dtSlug = `${filterMakul[0]["nama_mk"]} - ${filterMakul[0]["pengampu"]}`;

              await ctx.editMessageText('Anda memilih matakuliah <b>'+makul+'</b>',{parse_mode:'HTML'});
              const dtPertemuan = await pertemuan(link,ctx);
              if(dtPertemuan.length>0){
                const textPertemuan = dtPertemuan.map(el => {
                  let strShow = '<b>'+el["no"]+'.) '+el["pertemuan"]+'</b>\n'+
                  '- Tanggal: '+el["tanggal"]+'\n'+
                  '- Jam: '+el["jam"]+ '\n- <b>'+el["status"]+el["emoji"]+'</b>\n'+
                  '- Link: '+el["link"];
                  return strShow;
                });
                let strDtPertemuan = '<b>═══✪ List All Status Presenzi ✪═══\n'+
                'Makul: '+dtSlug+'</b>\n\n';
                await ctx.reply(strDtPertemuan+textPertemuan.join('\n\n'),{parse_mode:'HTML'});
              }else{
                let strDtPertemuan = "<b>═══✪ Belum Ada Pertemuan ✪═══</b>";
                await ctx.reply(strDtPertemuan,{parse_mode:'HTML'});
              }
            }else{
              await ctx.reply('Mengambil data makul gagal.\nSilakan ulangi!');
            }
          });
        }

        let params = {
          "tipe_log":"check_menu",
          "kode_log":"absenmakul",
          "desc":`${ctx.from.first_name} mengecek menu absenmakul`
        };
        const saveLog = await utils.saveToLog(params,userID);
      }
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  bot.command('rekapabsen', async(ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isExpired = await utils.checkExpired(userID);
      if(isExpired){
        await ctx.reply("<b>Maaf akun anda telah expired :(</b>\nAnda tidak bisa menggunakan perintah ini lagi",
              {parse_mode:'HTML'});
      }else{
        const data = await rekapAbsen(ctx);
        if(data.length > 0){
          var statsPresent = (data[0].presentase == '100.0%') ? '100%':data[0].presentase;
          const presentaseFont = CFonts.render(statsPresent,
            {font: 'slick',
            maxLength:10,
          	letterSpacing: 0,
          	space: true});
          let strStatistik = '<b>📈​ Statistik Presentaze Absen​</b>'+presentaseFont.string+
                    '<b>📊 Total Hadir : ('+data[0].tot_hadir+')</b>\n'+
                    '<b>📊 Total Pertemuan : ('+data[0].tot_pertemuan+')</b>';
          await ctx.reply(strStatistik,{parse_mode:'HTML'});
          strListrekap = data[0].datarekap.map((val,index) => {
            let emojiLast = ((index+1) == data[0].datarekap.length) ? ' ✅' : '';
            return '<b>'+val.makul+'</b>'+emojiLast+'\n<i>-- Tot. Pertemuan:</i> '+val.tot_pertemuan
                +'\n<i>-- Jml. Hadir :</i> '+val.jml_hadir
                +'\n<i>-- Jml. Alpha :</i> '+val.jml_alpha
                +'\n<i>-- Jml. Ijin :</i> '+val.jml_ijin
                +'\n<i>-- Jml. Sakit :</i> '+val.jml_sakit;
          });
          let strDatarekap = '<b>═══✪ Data Rekapitulasi ✪═══</b>\n\n'+strListrekap.join('\n\n');
          await ctx.reply(strDatarekap,{parse_mode:'HTML'});

          let params = {
            "tipe_log":"check_menu",
            "kode_log":"rekapabsen",
            "desc":`${ctx.from.first_name} mengecek menu rekapabsen`
          };
          const saveLog = await utils.saveToLog(params,userID);
        }
      }
    }
  })

  bot.command('showprofile', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      const newUser = await MongoDB.getCollection('users');
      var userProfile = await newUser.find({userid:userID}).toArray();
      var email = userProfile[0]["email"];
      var nim = userProfile[0]["nim"];
      var location = userProfile[0]["location"];
      var expired_in = userProfile[0]["expired_in"];
      var status = (userProfile[0]["is_active"] === 1)?'Aktif ✅':'Tidak Aktif ⛔';
      // var password = b64('decode',userProfile[0]["password"]);
      let strMenuProfile = '<b>════✪ Menu Profile ✪════</b>\n\n'+
          '-<b>Email</b> : '+email+'\n\n'+
          '-<b>NIM</b> : '+nim+'\n\n'+
          '-<b>Location</b> : '+location+'\n\n'+
          '-<b>Expired In</b> : '+expired_in+'\n\n'+
          '-<b>Status Akun</b> : '+status;

      await bot.telegram.sendMessage(ctx.chat.id, strMenuProfile, {
          parse_mode:'HTML',
          reply_markup:{
            inline_keyboard: [
              [{text:"Show My Location",callback_data:"location"},
              {text:"Edit My Profile ",callback_data:"profile"}]
            ]
          },
        });

      await bot.action(['location','profile'], async (ctx) => {
        var userID = ctx.chat.id.toString();
        const newUser = await MongoDB.getCollection('users');
        var profile = await newUser.find({userid:userID}).toArray();

        let txt = ctx.match[0];
        await ctx.editMessageReplyMarkup({
          reply_markup: { remove_keyboard: true },
        })
        if(txt == 'location'){
          const newLoc = await MongoDB.getCollection('locations');
          var currLoc = await newLoc.find({nama_lokasi:profile[0]["location"]}).toArray();
          if(currLoc.length > 0){
            await ctx.reply('Menampilkan Koordinat untuk lokasi: <b>'+currLoc[0]["nama_lokasi"]+'</b>', {parse_mode:'HTML'});
            return await bot.telegram.sendLocation(ctx.chat.id , currLoc[0]["latitude"], currLoc[0]["longitude"]);
          }else{
            return await ctx.reply("Lokasi anda sekarang undefined, silakan ganti di menu /editlocation");
          }
        }else if(txt == 'profile'){ // menu edit
          await ctx.reply('Menampilkan edit untuk profil: <b>'+profile[0]["email"]+'</b>', {parse_mode:'HTML'});
          return await ctx.scene.enter('edit');
        }
      });

      let params = {
        "tipe_log":"check_menu",
        "kode_log":"showprofile",
        "desc":`${ctx.from.first_name} mengecek menu showprofile`
      };
      const saveLog = await utils.saveToLog(params,userID);
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  bot.command('logout', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      const newUser = await MongoDB.getCollection('users');
      var userProfile = await newUser.find({userid:userID}).toArray();

      let hasCookie = userProfile[0]["cookie"];
      if(hasCookie != "-"){
        let message = '<b>[PERINGATAN] ⚠️</b><i>\n\n'+
        '"Yakin untuk logout akun?"</i>\nlogout akan merfresh kembali session akun anda!';
        var options = {
          parse_mode:'HTML',
          reply_markup:{
            inline_keyboard: [
              [{text:"Ya",callback_data:"yes_logout"},{text:"Tidak",callback_data:"no_logout"}]
            ]
          },
        };
        await bot.telegram.sendMessage(ctx.chat.id,message,options);
        await bot.action(['yes_logout','no_logout'], async (ctx) => {
          let txt = ctx.match[0];
          await ctx.editMessageReplyMarkup({
            reply_markup: { remove_keyboard: true },
          })
          let pilihan = "-";
          if(txt == 'yes_logout'){
            pilihan = "Anda memilih logout";
            await newUser.updateOne({userid:userID},{$set:{cookie:'-'}}); //=> update row cookie -> '-'
            let params = {
              "tipe_log":"check_menu",
              "kode_log":"logout",
              "desc":`${ctx.from.first_name} memilih logout`
            };
            const saveLog = await utils.saveToLog(params,userID);
          }else if(txt == 'no_logout'){
            pilihan = "Anda memilih tidak logout";
          }
          return await ctx.reply(pilihan);
        });
      }else{
        await ctx.reply("<b>Anda tidak memiliki session.</b>\nSilakan login dahulu agar bisa logout :)",
              {parse_mode:'HTML'});
      }
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  const userRegister = new Scenes.WizardScene( // form wizard register
      'register',
      async (ctx) => {
        const newdtUsers = await MongoDB.getCollection('users');
        var dtUsers = await newdtUsers.find({}).toArray();

        const newdtLoc = await MongoDB.getCollection('locations');
        var dtLocations = await newdtLoc.find({}).toArray();
        await ctx.reply('<b>(1/5) Reply email</b> studentmu cuk\n<i>(cth: udin@student.uns.ac.id)</i>',{parse_mode:'HTML'});
        ctx.scene.session.user = {};
        ctx.scene.session.user.userID = ctx.chat.id.toString();
        ctx.scene.session.dataUsers = dtUsers;
        ctx.scene.session.dataLocations = dtLocations;
        return ctx.wizard.next();
      },
      async (ctx) => {
        var email = ctx.message.text;
        var dtUsers = ctx.scene.session.dataUsers;
        var isValidEmail = await utils.isValidEmail(email);

        var dtEmail = dtUsers.map(el => el["email"]);
        if (email.length < 20 || !isValidEmail) {
           ctx.reply("<b>Email yang anda masukkan invalid</b>\nSilakan ulangi langkah dari awal!",
                    {parse_mode:'HTML'});
           return ctx.scene.leave();
        }else if(dtEmail.includes(email)){
          ctx.reply("<b>Email yang dimasukkan sudah terdaftar</b>\nSilakan gunakan email lain atau hubungi maintainer untuk menghapus!",
                    {parse_mode:'HTML'});
          return ctx.scene.leave();
        }
        ctx.scene.session.user.email = email;
        await bot.telegram.sendMessage(ctx.chat.id,'<b>(2/5) Reply passwd</b> studentmu cuk\n<i>(cth: udinpasswd123)</i>',
            {reply_to_message_id: ctx.message.message_id, parse_mode:'HTML'});
        return ctx.wizard.next();
      },
      async (ctx) => {
        var passwd = ctx.message.text;
        if (passwd.length < 8) {
          ctx.reply("<b>Password harus lebih dari 7 karakter</b>\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
          return ctx.scene.leave();
        }
        ctx.scene.session.user.password = passwd;
        await bot.telegram.sendMessage(ctx.chat.id,'<b>(3/5) Reply NIM-mu</b> cuk \n<i>(cth: M221xxx)</i>',
              {reply_to_message_id: ctx.message.message_id, parse_mode:'HTML'});
        return ctx.wizard.next();
      },
      async (ctx) => {
        var nim = ctx.message.text;
        var dtUsers = ctx.scene.session.dataUsers;
        var dtLocations = ctx.scene.session.dataLocations;
        var isValidNIM = await utils.isValidNIM(nim);

        var dtNim = dtUsers.map(el => el["nim"]);
        if (nim.length < 8 || nim.length > 10 || !isValidNIM) {
          ctx.reply("<b>NIM yang anda masukkan invalid</b>\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
          return ctx.scene.leave();
        }else if(dtNim.includes(nim)){
          ctx.reply("<b>NIM yang dimasukkan sudah terdaftar.</b>\nSilakan gunakan NIM lain atau hubungi maintainer untuk menghapus!",
                    {parse_mode:'HTML'});
          return ctx.scene.leave();
        }
        ctx.scene.session.user.nim = nim;

        let dtLocation = dtLocations.filter(el => el["type"] == "default"); // filter type default loc
        let dtSplit = await utils.splitArray(dtLocation.map(el => ({text:el["nama_lokasi"]})),2);
        var options = {
          reply_to_message_id:ctx.message.message_id,
          parse_mode:'HTML',
          reply_markup:{
            remove_keyboard: true,
            keyboard: dtSplit,
            one_time_keyboard:true,
            // resize_keyboard:true
          },
        };
        await bot.telegram.sendMessage(ctx.chat.id,"<b>(4/5) Pilih lokasi absen-mu</b> cuk\n<i>(cth: Kampus Pabelan)</i>",options);
        return ctx.wizard.next();
      },
      async (ctx) => {
        var loc = ctx.message.text;
        var dtLocations = ctx.scene.session.dataLocations;

        let dtLocation = dtLocations.map(e => e["nama_lokasi"]);
        const isTrueLocation = dtLocation.includes(loc);
        if (!isTrueLocation) {
            ctx.reply("<b>Lokasi tidak ada pada daftar!</b>\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
            return ctx.scene.leave();
         }
        ctx.scene.session.user.location = loc;

        var strSecretCode = "<b>(5/5) Luwak white coffee </b>...\n<i>Passwordnya? </i>";
        await bot.telegram.sendMessage(ctx.chat.id,strSecretCode,
          {reply_to_message_id:ctx.message.message_id,
            parse_mode:'HTML',
            reply_markup: JSON.stringify({remove_keyboard: true})});
        return ctx.wizard.next();
      },
      async (ctx) => {
        var secretCode = ctx.message.text;
        const newSC = await MongoDB.getCollection('secretcodes');
        var dtSecretCodes = await newSC.find({}).toArray();
        var dtCode = dtSecretCodes.map(e => e["code"]);
        var isTrueSecretCode = dtCode.includes(secretCode);
        if (!isTrueSecretCode) {
          await bot.telegram.sendMessage(ctx.chat.id,
                "<b>Maaf lur, bot ini cuman iseng belaka.</b>\nAnda kena prank wkwkwk 😂😂😂",
                {reply_to_message_id:ctx.message.message_id,parse_mode:'HTML'});
          return ctx.scene.leave();
        }
        var filterCode = dtSecretCodes.filter(e => e["code"] == secretCode);
        if(filterCode[0]["kuota_used"] < filterCode[0]["max_kuota"]){ // jika kuota code msh avail
          ctx.scene.session.user.code = secretCode;
          ctx.scene.session.user.expired = filterCode[0]["time_expired"].split('|');
          const isSaved = await utils.saveSessionUser('register',ctx.scene.session.user);
          if(isSaved){
            ctx.reply('<b>Pendaftaran Berhasil 🥳</b>\nSilakan masuk ke menu utama dengan tap link /menuutama',
            {parse_mode:'HTML'});

            var userID = ctx.scene.session.user.userID;
            let params = {
              "tipe_log":"register_user",
              "kode_log":`@${ctx.from.username}`,
              "desc":`${ctx.from.first_name} berhasil mendaftar`
            };
            const saveLog = await utils.saveToLog(params,userID);
          }else{
            ctx.reply('<b>Pendaftaran Gagal.</b>\nSilakan ulangi langkah pendaftaran /gasdaftar',
            {parse_mode:'HTML'});
          }
        }else{
          ctx.reply('<b>Pendaftaran Gagal.</b>\nSecret Code yang dimasukkan melebihi batas maksimum pengguna!',
                {parse_mode:'HTML'});
        }
        return ctx.scene.leave();
      },
  );

  const userEdit = new Scenes.WizardScene( // form wizard edit
      'edit',
      async (ctx) => {
        var userID = ctx.chat.id.toString();
        const newUser = await MongoDB.getCollection('users');
        var userProfile = await newUser.find({userid:userID}).toArray();
        const newdtUsers = await MongoDB.getCollection('users');
        var dtUsers = await newdtUsers.find({}).toArray();

        var email = userProfile[0]["email"];
        var password = userProfile[0]['password'];
        var nim = userProfile[0]['nim'];
        var location = userProfile[0]['location'];
        let strEmail = '<b>(1/3) Edit email</b> studentmu cuk\n<i>'+
                      '(email lama: '+email+')</i>'
        await ctx.reply(strEmail,{parse_mode:'HTML'});

        ctx.scene.session.user = {};
        ctx.scene.session.user.userID = userID;
        ctx.scene.session.user.oldEmail = email;
        ctx.scene.session.user.oldPassword = b64('decode',password);
        ctx.scene.session.user.oldNim = nim;
        ctx.scene.session.dataUsers = dtUsers;
        return ctx.wizard.next();
      },
      async (ctx) => {
        try {
          var email = ctx.message.text;
          var dtUsers = ctx.scene.session.dataUsers;
          var isValidEmail = await utils.isValidEmail(email);
          var dtEmail = dtUsers.map(el => el["email"]);
          var oldEmail = ctx.scene.session.user.oldEmail;

          if (email.length < 20 || !isValidEmail) {
             ctx.reply("<b>Email yang anda masukkan invalid</b>\nSilakan ulangi langkah dari awal!",
                      {parse_mode:'HTML'});
             return ctx.scene.leave();
          }else if(dtEmail.includes(email) && email != oldEmail){
            ctx.reply("<b>Email yang dimasukkan sudah terdaftar</b>\nSilakan gunakan email lain atau"+
                  "hubungi maintainer untuk menghapus!",{parse_mode:'HTML'});
            return ctx.scene.leave();
          }

          ctx.scene.session.user.email = email;
          let strPasswd = '<b>(2/3) Edit passwd</b> studentmu cuk.\n'+
                        '<i>isikan "-" (tanpa petik) jika tdk ingin diganti</i>'

          await bot.telegram.sendMessage(ctx.chat.id,strPasswd,
              {reply_to_message_id: ctx.message.message_id, parse_mode:'HTML'});
          return ctx.wizard.next();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema /editprofile!");
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          var passwd = ctx.message.text;
          var nim = ctx.scene.session.user.oldNim;
          if (passwd.length < 8 && passwd != '-') {
            ctx.reply("<b>Password harus lebih dari 7 karakter</b>\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
            return ctx.scene.leave();
          }else if(passwd == '-'){ // old passwd -> new passwd
            ctx.scene.session.user.password = ctx.scene.session.user.oldPassword;
          }else{ // text -> new passwd
            ctx.scene.session.user.password = passwd;
          }
          let strNim = '<b>(3/3) Edit NIM-mu</b> cuk \n<i>'+
                        '(NIM lama: '+nim+')</i>'
          await bot.telegram.sendMessage(ctx.chat.id, strNim,
                {reply_to_message_id: ctx.message.message_id, parse_mode:'HTML'});
          return ctx.wizard.next();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema /editprofile!");
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          var nim = ctx.message.text;
          var oldNim = ctx.scene.session.user.oldNim;
          var dtUsers = ctx.scene.session.dataUsers;
          var isValidNIM = await utils.isValidNIM(nim);
          var dtNim = dtUsers.map(el => el["nim"]);
          if (nim.length < 8 || nim.length > 10 || !isValidNIM) {
            ctx.reply("<b>NIM yang anda masukkan invalid</b>\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
            return ctx.scene.leave();
          }else if(dtNim.includes(nim) && nim != oldNim){
            ctx.reply("<b>NIM yang dimasukkan sudah terdaftar.</b>\nSilakan gunakan NIM lain atau hubungi maintainer untuk menghapus!",
                      {parse_mode:'HTML'});
            return ctx.scene.leave();
          }

          ctx.scene.session.user.nim = nim;
          const isSaved = await utils.saveSessionUser('edit',ctx.scene.session.user);
          if(isSaved){
            let strMessage = '<b>Update data profile berhasil </b>\nCheck data lagi dengan /showprofile atau masuk ke /menuutama';
            await bot.telegram.sendMessage(ctx.chat.id,strMessage,
              {reply_to_message_id:ctx.message.message_id,
                parse_mode:'HTML',
                reply_markup: JSON.stringify({remove_keyboard: true})});

            var userID = ctx.scene.session.user.userID;
            let params = {
              "tipe_log":"update_user",
              "kode_log":`@${ctx.from.username}`,
              "desc":`${ctx.from.first_name} berhasil mengupdate data user`
            };
            const saveLog = await utils.saveToLog(params,userID);
          }else{
            ctx.reply("<b>Update data profile gagal.</b>\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
          }
          return ctx.scene.leave();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema /editprofile!");
          return ctx.scene.leave();
        }
      }
  );
  const reqLocation = new Scenes.WizardScene(
      'reqLocation',
      async (ctx) => {
        try {
          await ctx.reply('<b>(1/2) Share lokasimu</b> cuk\n<i>(klik icon attach -> '+
                'tab icon location -> Send My Current Location)</i>',
          {parse_mode:'HTML'});
          ctx.scene.session.location = {};
          ctx.scene.session.location.userID = ctx.chat.id.toString();
          return ctx.wizard.next();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema\n/editlocation!");
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          if(!ctx.message.location){
            await ctx.reply("<b>Kirim lokasi-ne hlo cok...</b>\nSilakan ulangi langkah dari awal",{parse_mode:'HTML'});
            return ctx.scene.leave();
          }else{
            let strLoc = '<b>Lokasi Berhasil didapatkan ✅</b>';
            await ctx.reply(strLoc, {parse_mode:'HTML'});
            ctx.scene.session.location.latitude = ctx.message.location.latitude.toString();
            ctx.scene.session.location.longitude = ctx.message.location.longitude.toString();
          }
          await ctx.reply('<b>(2/2) Masukkan nama lokasi ini </b>cuk\n<i>(cth: Rumah Saya)</i>',{parse_mode:'HTML'});
          return ctx.wizard.next();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema\n/editlocation!");
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          var userid = ctx.scene.session.location.userID;
          var namaLoc = ctx.message.text;
          const newUser = await MongoDB.getCollection('users');
          var userProfile = await newUser.find({userid:userid}).toArray();
          var location = userProfile[0]["location"];

          const newLoc = await MongoDB.getCollection('locations');
          var dataLoc = await newLoc.find({}).toArray();
          const isValidLokasi = await utils.isValidNamaLokasi(namaLoc);
          var filteredLoc = dataLoc.filter(el => el["nama_lokasi"] == location);
              dataLoc = dataLoc.map(el => el["nama_lokasi"]);
          if (namaLoc.length < 6 || !isValidLokasi) {
            ctx.reply("<b>Nama Lokasi yang dimasukkan invalid.</b>\n- Harus lebih dari 6 karakter"+
                "\n- Tidak menggunakan karakter khusus\n\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
            return ctx.scene.leave();
          }else if(dataLoc.includes(namaLoc) && namaLoc != location){
            ctx.reply("<b>Nama Lokasi sudah terdaftar.</b>\nSilakan gunakan Nama Lokasi lain!",
                      {parse_mode:'HTML'});
            return ctx.scene.leave();
          }

          ctx.scene.session.location.namaLokasi = namaLoc;
          ctx.scene.session.location.oldLokasi = location;
          ctx.scene.session.location.tipeLokasi = filteredLoc[0]["type"];
          const isSaved = await utils.saveSessionLocation(ctx.scene.session.location);
          if(isSaved){
            let strMessage = '<b>Update data lokasi berhasil.</b>\nCheck data lagi dengan:'+
                              '\n/showprofile -> klik show my location';
            await ctx.reply(strMessage, {parse_mode:'HTML'});

            var userID = ctx.scene.session.location.userID;
            let params = {
              "tipe_log":"update_location",
              "kode_log":`@${ctx.from.username}`,
              "desc":`${ctx.from.first_name} berhasil mengupdate data lokasi ke ${namaLoc}`
            };
            const saveLog = await utils.saveToLog(params,userID);
          }else{
            await ctx.reply("<b>Update data lokasi gagal.</b>\nSilakan ulangi langkah dari awal!",{parse_mode:'HTML'});
          }
          return ctx.scene.leave();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema\n/editlocation!");
          return ctx.scene.leave();
        }
      }
  );

  const broadcast = new Scenes.WizardScene(
    'pesansiaran',
      async (ctx) => {
        try {
          await ctx.reply('<b>═══✪ Menu Pesan Siaran ✪═══</b>\n\n'+
            '- Parameter ada 3 yaitu all, code & userid\n'+
            '- Parameter semua data user: `all`\n'+
            '- Parameter code: `code|secretCode-secretCode-etc`\n'+
            '- Parameter userid: `userid|userId-userId-etc`\n'+
            '- Untuk melihat data user/code masuk menu /listusers  /listcodes \n\n',
          {parse_mode:'HTML'});

          await ctx.reply('<b>(1/2) Pilih parameter penerima pesan ...</b>\n<i>(cth: userid|3333-4444-xxx)</i>',
          {parse_mode:'HTML'});

          ctx.scene.session.broadcast = {};
          ctx.scene.session.broadcast.userID = ctx.chat.id.toString();
          return ctx.wizard.next();
        }catch (e) {
          console.log(e);
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema\n/ngumumin !");
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          let paramsMsg = ctx.message.text; // all / group|katebe4all-m4k4ng4n / userid|343245-352525
          let newParamsMsg = paramsMsg.split('|');
          var dtParams = ["all", "code", "userid"];
          var dtPenerimaInvalid = [];
          var dtPenerimaValid = [];

          if(!dtParams.includes(newParamsMsg[0])){ // jika parameter tidak dikenali
            ctx.reply("Parameter penerima pesan invalid\nSilakan ulangi langkah dari awal!");
            return ctx.scene.leave();
          }else if(newParamsMsg[0] != 'all' & newParamsMsg.length == 1){
            ctx.reply("Penulisan parameter pesan masih invalid\nSilakan ulangi langkah dari awal!");
            return ctx.scene.leave();
          }
          var tipePenerima = newParamsMsg[0];
          if(tipePenerima != 'all'){
            var tipeCollection = (tipePenerima == 'code')?'secretcodes':'users';
            const newData = await MongoDB.getCollection(tipeCollection);
            var data = await newData.find({}).toArray();
            var availPenerima = data.map(el => el[tipePenerima]);
            var dtPenerima = newParamsMsg[1].split('-');
            for(var i=0;i<dtPenerima.length;i++){
              if(availPenerima.includes(dtPenerima[i])){ // jika param penerima ada dlm avail penerima
                dtPenerimaValid.push(dtPenerima[i]);
              }else{
                dtPenerimaInvalid.push(dtPenerima[i]);
              }
            }
            if(dtPenerimaInvalid.length > 0){
              ctx.reply("Penerima pesan tidak ada dalam database\nSilakan ulangi langkah dari awal!");
              return ctx.scene.leave();
            }
          }

          await ctx.reply('<b>(2/2) Silakan tulis text pesan ...</b>\n<i>(cth: <b>Hallo {email} ..</b>)</i>',
            {parse_mode:'HTML'});
          ctx.scene.session.broadcast.dataPenerima = dtPenerimaValid;
          ctx.scene.session.broadcast.parameter = tipePenerima;
          return ctx.wizard.next();
        }catch (e) {
          console.log(e);
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema\n/ngumumin !");
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          var textMsg = ctx.message.text;
          if(textMsg.length < 2){
            return ctx.scene.leave();
          }
          ctx.scene.session.broadcast.textMsg = textMsg;
          // sendBroadcast
          var dataBroadcast = await utils.sendBroadcast(ctx.scene.session.broadcast);
          for(var bc = 0; bc<dataBroadcast.length; bc++){
            // console.log(dataBroadcast[bc]["userid"]+' '+dataBroadcast[bc]["pesan"]);
            bot.telegram.sendMessage(dataBroadcast[bc]["userid"],dataBroadcast[bc]["pesan"],{parse_mode:'HTML'});
          }
          await ctx.reply('<b>Mengirimkan pesan siaran berhasil 🥳</b>',
          {parse_mode:'HTML'});
          return ctx.scene.leave();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema\n/ngumumin !");
          return ctx.scene.leave();
        }
      }
  );

  const stage = new Scenes.Stage([userRegister, userEdit, reqLocation, broadcast]);
  bot.use(session());
  stage.command('cancel', (ctx) => {
      ctx.reply("Operasi sekarang dibatalkan");
      return ctx.scene.leave();
  });
  bot.use(stage.middleware());

  bot.command('gasdaftar', async ctx => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      await ctx.reply("<b>Akun anda sudah terdaftar.</b>\nPilih menu /editprofile untuk mengupdate akun",
            {parse_mode:'HTML'})
    }else{
      if(MongoDB.checkDB() != undefined){
        let strMenuDaftar = '<b>═══✪ Menu Daftar ✪═══</b>\n\n'+
            '- Terdapat 5 langkah utk mendaftar akun\n'+
            '- Gunakan /cancel untuk membatalkan proses\n'+
            '- 1 Akun tele untuk 1 kali daftar \n'+
            '- Input password dienkripsi (jadi aman & tidak disalahgunakan)\n'+
            '- Pilihan lokasi masih default, namun bisa diganti sesuai koordinat setelah terdaftar';
        await ctx.reply(strMenuDaftar,{parse_mode:'HTML'});
        await ctx.scene.enter('register');
      }
    }
  })

  bot.command('editprofile', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(!isExistID){
      await ctx.reply("<b>Anda belum mempunyai akun.</b>\nPilih menu /gasdaftar untuk mendaftar akun",
      {parse_mode:'HTML'})
    }else{
      let strMenuDaftar = '<b>═══✪ Menu Edit ✪═══</b>\n\n'+
      '- Gunakan /cancel untuk membatalkan proses\n'+
      '- Menu ini hanya mengedit email, passwd, & NIM\n'+
      '- Gunakan /editlocation untuk mengedit lokasi sesuai GPS anda';
      await ctx.reply(strMenuDaftar,{parse_mode:'HTML'});
      await ctx.scene.enter('edit');
    }
  })

  bot.command('editlocation', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(!isExistID){
      await ctx.reply("<b>Anda belum mempunyai akun.</b>\nPilih menu /gasdaftar untuk mendaftar akun",
      {parse_mode:'HTML'})
    }else{
      let strMenuLokasi = '<b>═══✪ Edit Lokasi Anda ✪═══</b>\n\n'+
      '- Aktifkan GPS untuk bisa membagikan lokasimu secara realtime\n'+
      '- Input nama lokasi harus unique (tidak boleh sama)';
      await ctx.reply(strMenuLokasi,{parse_mode:'HTML'});
      await ctx.scene.enter('reqLocation');
    }
  })

  bot.command('ngumumin', async ctx => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isMaintainer = (userID === process.env.MAINTAINER.toString());
      if(isMaintainer){
        await ctx.scene.enter('pesansiaran');
      }else{
        await ctx.reply("<b>Anda Bukan Maintainer</b>",
        {parse_mode:'HTML'})
      }
    }else{
      await ctx.reply('Oalah ... njih-njihh, <b>Ndoro '+
          ctx.from.first_name+'</b>\nApa itu `'+ctx.message.text+'` 🙃? hmmm', {parse_mode:'HTML'});
    }
  })

  bot.command('listusers', async ctx => {
    const splitEmail = (email) => {
      return email.split('@')[0];
    };

    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isMaintainer = (userID === process.env.MAINTAINER.toString());
      if(isMaintainer){
        let strHeader = '<b>══✪ Menu List Pengguna ✪══</b>\n\n';
        const newUser = await MongoDB.getCollection('users');
        var dtUsers = await newUser.find({}).limit(25).toArray();
        let dtPesan = dtUsers.map((el,id) => {
          let isActive = (el["is_active"] == 1) ? 'Aktif': 'Tidak Aktif' ;
          let strDetail = '\n-- '+el["nim"]+'\n-- '+splitEmail(el["email"])
              +'\n-- '+el["location"]+'\n-- '+isActive;

          return `${id+1}.) <code>${el["userid"]}</code> ${strDetail}`;
        });
        await ctx.reply(strHeader+dtPesan.join('\n\n'),
          {parse_mode:'HTML'});
      }else{
        await ctx.reply("<b>Anda Bukan Maintainer</b>",
          {parse_mode:'HTML'});
      }
    }else{
      await ctx.reply('Oalah ... njih-njihh, <b>Ndoro '+
          ctx.from.first_name+'</b>\nApa itu `'+ctx.message.text+'` 🙃? hmmm', {parse_mode:'HTML'});
    }
  })

  bot.command('listcodes', async ctx => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isMaintainer = (userID === process.env.MAINTAINER.toString());
      if(isMaintainer){
        let strHeader = '<b>══✪ Menu List Secret Code ✪══</b>\n\n';
        const newUser = await MongoDB.getCollection('users');
        var dtUsers = await newUser.find({}).toArray();

        const newSC = await MongoDB.getCollection('secretcodes');
        var dtSC = await newSC.find({}).limit(25).toArray();
        let dtPesan = dtSC.map((el,id) => {
          var listNim = dtUsers.filter(user => user["code"] == el["code"]);
              listNim = listNim.map(nim => nim["nim"]);
          let strDetail = '\n-- kuota ('+el["kuota_used"]+'/'+el["max_kuota"]+')'
              +'\n-- '+el["time_expired"]
              +'\n-- '+el["desc"]
              +'\n-- NIM ('+listNim.join(', ')+')';

          return `${id+1}.) <code>${el["code"]}</code> ${strDetail}`;
        });
        await ctx.reply(strHeader+dtPesan.join('\n\n'),
          {parse_mode:'HTML'});
      }else{
        await ctx.reply("<b>Anda Bukan Maintainer</b>",
          {parse_mode:'HTML'});
      }
    }else{
      await ctx.reply('Oalah ... njih-njihh, <b>Ndoro '+
          ctx.from.first_name+'</b>\nApa itu `'+ctx.message.text+'` 🙃? hmmm', {parse_mode:'HTML'});
    }
  })

  bot.command('bacalogs', async ctx => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isMaintainer = (userID === process.env.MAINTAINER.toString());
      if(isMaintainer){
        let message = '<b>[PILIH FILTER LOG] 📝</b>\n\n'+
        '"Berikut adalah filter untuk membaca log"\n<i>All LOG untuk semua logs & Today LOG untuk logs yang ada pada hari ini.</i>';
        var options = {
          parse_mode:'HTML',
          reply_markup:{
            inline_keyboard: [
              [{text:"Absen LOG",callback_data:"absen"},
                {text:"Register LOG",callback_data:"register"},
                {text:"Check Menu LOG",callback_data:"checkmenu"}],
              [{text:"Today LOG",callback_data:"today"}]
            ]
          },
        };

        await bot.telegram.sendMessage(ctx.chat.id,message,options);
        await bot.action(['checkmenu','absen','register','today'], async (ctx) => {
          let txt = ctx.match[0];
          await ctx.editMessageReplyMarkup({
            reply_markup: { remove_keyboard: true },
          })

          const newLog = await MongoDB.getCollection('logs');
          if(txt == 'checkmenu'){
            await ctx.reply("Anda memilih Filter Tipe Log Check Menu");
            const now = new Date();
            var nowStamp = convertTZ(now, "Asia/Jakarta");
            var tglNow = date.format(nowStamp,'DD-MM-YYYY');
            var dtLogs = await newLog.find(
              {
                $and: [
                  {timestamp:{$regex:"^"+tglNow}},
                  {tipe_log:"check_menu"},
                ]
              },
            ).sort({timestamp:-1}).limit(20).toArray(); // filter tipe check menu
          }else if(txt == 'absen'){
            await ctx.reply("Anda memilih Filter Tipe Log Absen");
            const now = new Date();
            var nowStamp = convertTZ(now, "Asia/Jakarta");
            var tglNow = date.format(nowStamp,'DD-MM-YYYY');
            var dtLogs = await newLog.find(
              {
                $and: [
                  {timestamp:{$regex:"^"+tglNow}},
                  {tipe_log:"absen"},
                ]
              },
              ).sort({timestamp:-1}).limit(10).toArray(); // filter tipe absen
          }else if(txt == 'register'){
            await ctx.reply("Anda memilih Filter Tipe Log Register");
            const now = new Date();
            var nowStamp = convertTZ(now, "Asia/Jakarta");
            var tglNow = date.format(nowStamp,'DD-MM-YYYY');
            var dtLogs = await newLog.find(
                {
                  $and : [
                    {timestamp:{$regex:"^"+tglNow}},
                    {$or: [
                      {tipe_log:"register_makul"},
                      {tipe_log:"register_user"}
                    ]}
                  ]
                }
              ).sort({timestamp:-1}).limit(20).toArray(); // filter tipe register user/makukl
          }else{
            await ctx.reply("Anda memilih Filter Today LOG");
            const now = new Date();
            var nowStamp = convertTZ(now, "Asia/Jakarta");
            var tglNow = date.format(nowStamp,'DD-MM-YYYY');
            var dtLogs = await newLog.find(
                {timestamp:{$regex:"^"+tglNow}}
              ).sort({timestamp:-1}).limit(10).toArray(); // filter  all today
          }
          let strHeader = '<b>══✪ Menu Baca Logs ✪══</b>\n\n';
          let dataStrlogs = dtLogs.map((el,id) => {
            let strDetail = '\n-- <i>prodi: '+el["kode_prodi"]
                +'\n-- userid: @'+el["by_user"]
                +'\n-- kode: '+el["kode_log"]
                +'\n-- timestamp: '+el["timestamp"]
                +'\n-- deskripsi: '+el["desc"]+'</i>';

            return `<b>${id+1}.) ${el["tipe_log"]}</b> ${strDetail}`;
          });

          return await ctx.reply(strHeader+dataStrlogs.join('\n\n'),
            {parse_mode:'HTML'});
        });


      }else{
        await ctx.reply("<b>Anda Bukan Maintainer</b>",
          {parse_mode:'HTML'});
      }
    }else{
      await ctx.reply('Oalah ... njih-njihh, <b>Ndoro '+
          ctx.from.first_name+'</b>\nApa itu `'+ctx.message.text+'` 🙃? hmmm', {parse_mode:'HTML'});
    }
  })

  bot.command('mygroupmk', async ctx => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      let strHeader = '<b>══✪ Menu Group Makul ✪══</b>\n\n';
      const newUser = await MongoDB.getCollection('users');
      var userProfile = await newUser.find({userid:userID}).toArray();

      const newGroup = await MongoDB.getCollection('groups');
      var myGroup = await newGroup.find({list_nim:{$in:[userProfile[0]["nim"]]}}).toArray();
      let dtPesan = myGroup.map((el,id) => {
        let strDetail = '\n- Kelas: '+el["kelas"]+'\n- Kode: '+el["kode_mk"]
            +'\n- Dosen: '+el["dosen"]
            +'\n- <b>Anggota: ('+el["list_nim"].join(', ')+')</b>';

        return `${id+1}.) <b>${el["nama_mk"]} 📚</b> ${strDetail}`;
      });
      if(myGroup.length > 0){
        await ctx.reply(strHeader+dtPesan.join('\n\n'),
          {parse_mode:'HTML'});
      }else{
        await ctx.reply('<b>═✪ Anda belum mendaftarkan makul ke group ✪═</b>\nSilakan tap /registermk untuk mendaftarkan makul',
          {parse_mode:'HTML'});
      }

      let params = {
        "tipe_log":"check_menu",
        "kode_log":"mygroupmk",
        "desc":`${ctx.from.first_name} mengecek menu mygroupmk`
      };
      const saveLog = await utils.saveToLog(params,userID);
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  bot.command('registermk', async ctx => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      var isExpired = await utils.checkExpired(userID);
      if(isExpired){
        await ctx.reply("<b>Maaf akun anda telah expired :(</b>\nAnda tidak bisa menggunakan perintah ini lagi",
              {parse_mode:'HTML'});
      }else{
        const data = await registerMakul(ctx);
        if(data.length > 0){
          const newUser = await MongoDB.getCollection('users');
          var userProfile = await newUser.find({userid:userID}).toArray();
          var nim = userProfile[0]["nim"];
          var extraParams = {"kode_prodi":nim.substring(0,4),"by_userid":userID};

          const newGroup = await MongoDB.getCollection('groups');
          for(var i=0; i<data.length; i++){
            const nSlugmakul = await newGroup.countDocuments({slugmakul:data[i]["slugmakul"]});
            let listNim = {"list_nim":[nim]};
            let newParams = {...data[i], ...extraParams, ...listNim};
            if(nSlugmakul == 0){ // jika di collection group belum ada maka insert
              await newGroup.insertOne(newParams);
            }else{
              const nListnim = await newGroup.countDocuments({
                slugmakul: data[i]["slugmakul"],
                list_nim: {$in:[nim]}
              });
              if(nListnim > 0){// jika di collection group field list_nim exist maka update jika tida maka only push nim
                await newGroup.updateOne(
                  {slugmakul: data[i]["slugmakul"]},
                  {$set:{...data[i], ...extraParams}}
                );
              }else{
                await newGroup.updateOne(
                  {slugmakul: data[i]["slugmakul"]},
                  {$push: {"list_nim":nim}}
                );
              }
            }
          }

        await ctx.reply('<b>Hore 🥳</b> sekarang bot ini dapat mengirimkan notifikasi jika salah satu anggota group makul telah menjalankan command gasabsen '+
        '\n\nSilakan tap /mygroupmk untuk melihat daftar makul terdaftar ke group atau /removemk untuk mereset pengaturan ini',
          {parse_mode:'HTML'});

        let params = {
          "tipe_log":"register_makul",
          "kode_log":nim,
          "desc":`${ctx.from.first_name} berhasil meregistrasi makul ke group`
        };
        const saveLog = await utils.saveToLog(params,userID);
        }
      }
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  bot.command('removemk', async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    if(isExistID){
      let message = '<b>[PERINGATAN] ⚠️</b><i>\n\n'+
      '"Yakin untuk menghapus makul anda pada group?"</i>\nMereset pengaturan ini akan menghentikan notifikasi jika ada absen!';
      var options = {
        parse_mode:'HTML',
        reply_markup:{
          inline_keyboard: [
            [{text:"Reset",callback_data:"yes_remove"},{text:"Cancel",callback_data:"no_remove"}]
          ]
        },
      };
      await bot.telegram.sendMessage(ctx.chat.id,message,options);
      await bot.action(['yes_remove','no_remove'], async (ctx) => {
        let txt = ctx.match[0];
        var userID = ctx.chat.id.toString();
        const newUser = await MongoDB.getCollection('users');
        var userProfile = await newUser.find({userid:userID}).toArray();
        var hasNim = userProfile[0]["nim"];

        await ctx.editMessageReplyMarkup({
          reply_markup: { remove_keyboard: true },
        })
        let pilihan = "-";
        if(txt == 'yes_remove'){
          pilihan = "Anda memilih Remove";
          const newGroup = await MongoDB.getCollection('groups');
          var dtGroup = await newGroup.find({
            list_nim: {$in:[hasNim]}
          }).toArray();
          for(var i=0; i<dtGroup.length; i++){
            await newGroup.updateOne(
              {slugmakul: dtGroup[i]["slugmakul"]},
              {$pull: {"list_nim":hasNim}}
            );
          }
        }else if(txt == 'no_remove'){
          pilihan = "Anda memilih Cancel";
        }
        return await ctx.reply(pilihan);
      });
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  bot.command('faq', async(ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    let message = "";
    if(isExistID){
      message = '<b>FAQ - Frequently Asked Question</b>\n\n'+
      '1.) Apakah saya bisa menggunakan BOT ini selamanya?\n<code>-- Ya, selama fitur dalam presensi OCW masih ada'+
      ' & tidak ada perubahan, kamu bisa menggunakan BOT ini selama yang kamu inginkan.</code>\n\n'+
      '2.) Bagaimana BOT ini bekerja?\n<code>-- BOT ini menggunakan teknik scrapping data & menggunakan fitur yang tersedia '+
      ' pada OCW & sama sekali tidak menggunakan bug/kesalahan pada sistem.</code>\n\n'+
      '3.) Apakah data username & password saya aman?\n<code>-- Aman. Password yang disimpan telah dienkripsi sebagaimana mestinya. '+
      'Maintainer sama sekali tidak menginginkan datamu untuk kepentingan apa pun</code>';
    }else{
      message = 'FAQ - Frequently Asked Question';
    }
    console.log(ctx.from.first_name+' mengecek menu faq');
    await ctx.reply(message,{parse_mode:'HTML'});
  })

  bot.help(async (ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    let message = "";
    if(isExistID){
      message = '<b>Help - Tutorial Penggunaan BOT</b>\n\n'+
      'Link tutorial cara pemakaian: https://drive.google.com/drive/folders/1aGh0-RIZrCWxyM0jyiiPsbizepUDvUie?usp=sharing \n\n'+
      'Silakan hubungi @CobaDev jika ada yang ingin ditanyakan lebih lanjut tentang BOT presenzi ini 👍';
    }else{
      'Help - Tutorial Penggunaan BOT'
    }
    console.log(ctx.from.first_name+' mengecek menu help');
    await ctx.reply(message,{parse_mode:'HTML'});
  })

  bot.command('about', async(ctx) => {
    var userID = ctx.chat.id.toString();
    var isExistID = await utils.checkExistID(userID);
    let message = "";
    if(isExistID){
      message = '<b>About - Tentang BOT ini</b>\n\n'+
      '<code>1.) BOT ini digunakan untuk mempermudah presensi mahasiswa UNS\n'+
      '2.) BOT ini sama sekali tidak ingin merugikan pihak manapun\n'+
      '3.) BOT ini hanya projek iseng belaka, untuk belajar, & lain hal\n'+
      '4.) BOT ini 100% gratis, namun jika anda ingin berdonasi, silakan hubungi Maintainer</code> @CobaDev 😊\n';
    }else{
      'About - Tentang BOT ini'
    }
    console.log(ctx.from.first_name+' mengecek menu about');
    await ctx.reply(message,{parse_mode:'HTML'});
  })


  bot.on('sticker', (ctx) => ctx.reply('👍'))
  bot.hears('hi', (ctx) => ctx.reply('Hai juga lurr'))
  bot.on('text', async (ctx) => {
    console.log(ctx.from.first_name+' mengetik '+ctx.message.text);
    await ctx.telegram.sendMessage(ctx.message.chat.id, 'Oalah ... njih-njihh, <b>Ndoro '+
        ctx.from.first_name+'</b>\nApa itu `'+ctx.message.text+'` 🙃? hmmm', {parse_mode:'HTML'});
  })

  bot.launch()

  process.once('SIGINT', () => {
    cleanup();
  })
  process.once('SIGTERM', () => {
    cleanup();
  })
});
