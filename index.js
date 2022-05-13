const { Telegraf, Scenes, session, Stage, WizardScene } = require('telegraf');
const { absensiBerlangsung, absensiMakul, absenkan,
   authLogin, pertemuan } = require('./menuController');
const { b64, utils } = require('./utils/myUtils');
const MongoDB = require('./utils/mongoUtil');

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
      message += '<b>Absensi</b>\n/login - ambil baru session akun'+
      '\n/gasabsen - tancap gas buat absen'+
      '\n/absenmakul - cek absen per-makul'+
      '\n/rekapabsen - (as soon as possible)\n\n'+
      '<b>Profile</b>\n/showprofile - tampil profile akun'+
      '\n/editprofile - edit profile akun'+
      '\n/editlocation - edit lokasi absen'+
      '\n/logout - hapus session akun';
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
        if(isLogin){
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
          const textPertemuan = data.map(el => "<b>"+el["no"]+".)"+el["makul"]+"</b> - ("+el["pertemuan"]+")");
          let strDtPertemuan = "<b>═✪ List Presenzi Berlangsung ✪═</b>\n\n";
          await ctx.reply(strDtPertemuan+textPertemuan.join('\n\n'),{parse_mode:'HTML'});
          if(data.length == 1){
            let filterNo = filterPresenzi(dtTxtId[0]); // auto absenkan jika 1 length
            let pertemuan = "Nomor("+filterNo[0]["no"]+")";
            const resp = await absenkan(dtTxtId[0],pertemuan,ctx);
          }else{ // data.length > 1
            Promise.all([dtTxtId,textPertemuan]).then(async res => {
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
                 await absenkan(txtId,pertemuan,ctx).then(resp => {
                   if(resp){
                     return ctx.answerCbQuery("Berhasil absen!");
                   }else{
                     return ctx.answerCbQuery("Gagal absen!");
                   }
                 });
               });
             });
          }
        }
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
              const dtPertemuan = await pertemuan(link,makul,ctx);
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
      }
    }else{
      await ctx.reply("Maaf anda perlu mendaftar untuk menggunakan perintah ini >.<");
    }
  })

  bot.command('rekapabsen', async(ctx) => {
    ctx.reply('Fitur ini akan dikembangkan selanjutnya!');
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
            ctx.reply('<b>Pendaftaran Berhasil 🥳</b>\nSilakan masuk ke menu utama dengan klik tombol /menuutama',
            {parse_mode:'HTML'});
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
      'broadcast',
      async (ctx) => {
        try {
          await ctx.reply('Kirim text cok ...',
          {parse_mode:'HTML'});
          ctx.scene.session.broadcast = {};
          ctx.scene.session.broadcast.userID = ctx.chat.id.toString();
          return ctx.wizard.next();
        } catch (e) {
          ctx.reply("Operasi sekarang dibatalkan\nAnda masih dalam skema\n/ngumumin !");
          return ctx.scene.leave();
        }
      },
      async (ctx) => {
        try {
          let textMsg = ctx.message.text;
          const newdtUsers = await MongoDB.getCollection('users');
          var dtUsers = await newdtUsers.find({}).toArray();
          for(let id=0; id<dtUsers.length; id++){
            let chatid = parseInt(dtUsers[id]["userid"]);
            let pesan = '<b>Hallo agan '+dtUsers[id]["email"]+'!</b>\n'+textMsg;
            bot.telegram.sendMessage(chatid,pesan, {parse_mode:'HTML'});
          }
          ctx.scene.session.broadcast.textMsg = textMsg;

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
      if(userID == process.env.MAINTAINER.toString()){
        await ctx.scene.enter('broadcast');
      }else{
        await ctx.reply("<b>Anda Bukan Maintainer</b>",
        {parse_mode:'HTML'})
      }
    }else{
      await ctx.reply('Oalah ... njih-njihh, <b>Ndoro '+
          ctx.from.first_name+'</b>\nApa itu `'+ctx.message.text+'` 🙃? hmmm', {parse_mode:'HTML'});
    }
  })

  bot.command('faq', async(ctx) => {
    ctx.reply('FAQ - Frequently Asked Question');
  })

  bot.help((ctx) => {
    ctx.reply('Help - Tutorial Penggunaan BOT');
  })

  bot.command('about', async(ctx) => {
    ctx.reply('About - Tentang BOT ini');
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
