const menuLogin = require('./menus/menuLogin');
const menuAbsBerlangsung = require('./menus/menuAbsensiBerlangsung');
const menuAbsMakul = require('./menus/menuAbsensiMakul');
const menuRkpAbsen = require('./menus/menuRekapAbsen');
const {b64, timestamp, convertTZ, utils} = require('./utils/myUtils');
const MongoDB = require('./utils/mongoUtil');
const axios = require('axios');
const cheerio = require('cheerio');

async function authLogin(ctx){
  var isSuccess = true;
  var userID = ctx.chat.id.toString();
  const newUser = await MongoDB.getCollection('users');
  var userProfile = await newUser.find({userid:userID}).toArray();

  let hasCookie = userProfile[0]["cookie"]; // strCookie
  if(hasCookie != "-"){
    const wrongCookieFormat = await utils.checkCookie(userID,hasCookie);
    if(wrongCookieFormat){
      await ctx.reply("Session login telah habis. Silakan ulangi langkah /login");
    }
    isSuccess = !wrongCookieFormat;
  } else {
    await ctx.reply("Sedang login...");
    await menuLogin.login(userID).then( async(login)=> {
      isSuccess = login[0].status;
      let dtCookie = login[0].cookie;
      if(!isSuccess){
        await ctx.reply('Gagal Login.\nEmail/password salah. Silakan edit data di menu /editprofile lalu ulangi lagi!');
        await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
        return false;
      }else{ // jika berhasil login & ada cookie
        const wrongCookieFormat = await utils.checkCookie(userID,dtCookie); // checkCookie cacat / tidak
        if(wrongCookieFormat){ // jika cookie cacat
          await ctx.reply('Gagal Login.\nSession masih belum tersimpan. Silakan ulangi lagi!');
          await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
          return false;
        }else{ // jika cookie tepat
          await ctx.reply('Berhasil Login');
          await newUser.updateOne({userid:userID},{$set:{cookie:dtCookie}});
        }
      }
    }).catch(function(err){
      // isSuccess = login[0].status;
      ctx.reply(err);
    });
  }
  return isSuccess;
}
async function absenkan(textid,textMsg,ctx){
	var isSuccess = false;
  var userID = ctx.chat.id.toString();
	try {
    const newUser = await MongoDB.getCollection('users');
    var userProfile = await newUser.find({userid:userID}).toArray();
    var nim = userProfile[0]["nim"];
    var location = userProfile[0]["location"];

    const newLoc = await MongoDB.getCollection('locations');
    var dtLocations = await newLoc.find({}).toArray();
    var filteredLoc = dtLocations.filter(el => el["nama_lokasi"] == location);
		const dtParams = {
				"nim":nim,
				"nimLogin":nim,
				"latitude":filteredLoc[0]["latitude"],
				"longitude":filteredLoc[0]["longitude"],
				"KESEHATAN":"SEHAT"
		};
		let url = textid.split(",");
		let URLs = url.map(v => ({"item":v,"params":dtParams}));
    let strCookie = userProfile[0]["cookie"];
		await menuAbsBerlangsung.prosesRequest(URLs,strCookie).then( async resp => {
			isSuccess= resp[0]["status"] == "200" ? true:false;
      let emoji = (isSuccess) ? " ✅ ":" ⛔ ";
      let sticker = (isSuccess) ? "CAACAgIAAxkBAAEEeB9iWDAITXFHA5cOPdqEouCfqwZn_gACCBUAAj-GGUuf0MrpW8vleyME"
          : "CAACAgIAAxkBAAEEeCFiWDDEHkNwllnCsqY4CenqDLuozwAClhcAAoflGUtNnxBdhrfv2yME";
      await ctx.reply("Status Absen: "+resp[0]["pesan"]+emoji,
      {
        parse_mode:'HTML',
        reply_markup: {inline_keyboard: [[ { text: "Buka Zoom/Meet", url: resp[0]["urlMeet"] } ]]}
      });
      await ctx.replyWithSticker(sticker);
      var isExistIdAbsen = await utils.checkExistIdAbsen(textid);
      if(!isExistIdAbsen){
        let params = {
          "tipe_log":"absen",
          "kode_log":`${textid}`,
          "desc":`@${ctx.from.first_name} berhasil absen. ${textMsg}`
        };
        if(!isSuccess){
          params.desc = `@${ctx.from.first_name} gagal absen. ${textMsg}`;
        }
        await utils.saveToLog(params,userID);
      }
		});

    return isSuccess;
	} catch (e) {
		console.log(e);
    return false;
	}
}
async function pertemuan(link,ctx){
  var dataPertemuan = [];
  const isLogin = await authLogin(ctx);
  if(isLogin){
    var userID = ctx.chat.id.toString();
    const newUser = await MongoDB.getCollection('users');
    var userProfile = await newUser.find({userid:userID}).toArray();
    let strCookie = userProfile[0]["cookie"];
    let hasCookie = (strCookie != "-") ? true:false;
    const pertemuan = await menuAbsMakul.pilihPertemuan(strCookie,hasCookie,link,ctx);
    if(pertemuan[0].status == false){
      if(hasCookie){
        await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
      }
      return false;
    }else{
      for (let id = 0; id < pertemuan[0].data.length; id++) {
        var dtPert = pertemuan[0].data[id];
        dtPert.no=id+1;
        dataPertemuan.push(dtPert);
      }
    }
  }
	return dataPertemuan;
}
async function absensiBerlangsung(ctx){
  var presenceData = [];
  const isLogin = await authLogin(ctx);
  if(isLogin){
    var strPesan = "";
    var userID = ctx.chat.id.toString();
    const newUser = await MongoDB.getCollection('users');
    var userProfile = await newUser.find({userid:userID}).toArray();
    let strCookie = userProfile[0]["cookie"];
    let hasCookie = (strCookie != "-") ? true:false;
    const data = await menuAbsBerlangsung.cekAbsensi(strCookie,hasCookie,ctx);
    strPesan = await data[0].pesan.join('\n\n');
    for (let id = 0; id < data[0].pertemuan.length; id++) {
      var dtPres = data[0].pertemuan[id];
      dtPres.message="<b>- "+data[0].pertemuan[id].makul+"</b> - ("+data[0].pertemuan[id].pertemuan+")";
      dtPres.no=id+1;
      presenceData.push(dtPres);
    }
    if(strPesan == ""){
      if (hasCookie) {
        await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
      }
      return false;
    }else{
      await ctx.reply(strPesan,{parse_mode:'HTML'});
      if(presenceData.length === 0){
        await ctx.replyWithSticker('CAACAgIAAxkBAAEEeDNiWDG9KUDHssVERo4EjFtg0MS5jAAChhQAArufCUjBILkT1ZXPGCME');
      }
    }
  }
  return presenceData;
}
async function absensiMakul(ctx){
  var dataMakul = [];
  const isLogin = await authLogin(ctx);
  if(isLogin){
    var userID = ctx.chat.id.toString();
    const newUser = await MongoDB.getCollection('users');
    var userProfile = await newUser.find({userid:userID}).toArray();
    let strCookie = userProfile[0]["cookie"];
    let hasCookie = (strCookie != "-") ? true:false;
    const matakuliah = await menuAbsMakul.absensiMK(strCookie,hasCookie,ctx);
    if(matakuliah[0].status == false){
      if(hasCookie){
        await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
      }
      return false;
    }else{
      dataMakul = matakuliah[0].data;
    }
  }
	return dataMakul;
}
async function rekapAbsen(ctx){
  var dataRekapabsen = [];
  const isLogin = await authLogin(ctx);
  if(isLogin){
    var userID = ctx.chat.id.toString();
    const newUser = await MongoDB.getCollection('users');
    var userProfile = await newUser.find({userid:userID}).toArray();
    let strCookie = userProfile[0]["cookie"];
    let hasCookie = (strCookie != "-") ? true:false;
    const rekapabsen = await menuRkpAbsen.rekapAbsen(strCookie,hasCookie,ctx);
    if(rekapabsen[0].status == false){
      if(hasCookie){
        await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
      }
      return false;
    }else{
      dataRekapabsen = rekapabsen[0].data;
    }
  }
	return dataRekapabsen;
}
async function registerMakul(ctx){
  var dataMakul = [];
  const isLogin = await authLogin(ctx);
  if(isLogin){
    var userID = ctx.chat.id.toString();
    const newUser = await MongoDB.getCollection('users');
    var userProfile = await newUser.find({userid:userID}).toArray();
    let strCookie = userProfile[0]["cookie"];
    let hasCookie = (strCookie != "-") ? true:false;
    const matakuliah = await menuAbsMakul.registerMK(strCookie,hasCookie,ctx);
    if(matakuliah[0].status == false){
      if(hasCookie){
        await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
      }
      return false;
    }else{
      dataMakul = matakuliah[0].data;
    }
  }
	return dataMakul;
}

module.exports = {
  authLogin,
	absenkan,
  pertemuan,
  absensiBerlangsung,
	absensiMakul,
  rekapAbsen,
  registerMakul
}
