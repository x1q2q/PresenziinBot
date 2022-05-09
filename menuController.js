const menuLogin = require('./menus/menuLogin');
const menuAbsBerlangsung = require('./menus/menuAbsensiBerlangsung');
const menuAbsMakul = require('./menus/menuAbsensiMakul');
const {b64, utils } = require('./utils/myUtils');
const MongoDB = require('./utils/mongoUtil');
const axios = require('axios');
const cheerio = require('cheerio');

async function authLogin(ctx){
  var isSuccess = true;
  var userID = ctx.chat.id.toString();
  const newUser = await MongoDB.getCollection('users');
  var userProfile = await newUser.find({userid:userID}).toArray();

  let hasCookie = userProfile[0]["cookie"];
  if(hasCookie != "-"){
    const isDel = await utils.checkCookie(userID,hasCookie);
    isSuccess = !isDel;
  } else {
    await ctx.reply("Sedang login...");
    await menuLogin.login(userID).then( async(login)=> {
      isSuccess = login[0].status;
      await ctx.reply(login[0].statusMsg);
      if(!isSuccess){
        await newUser.updateOne({userid:userID},{$set:{cookie:'-'}});
        return false;
      }
    }).catch(function(err){
      ctx.reply(err);
    });
  }
  return isSuccess;
}
async function absenkan(textid,pertemuan,ctx){
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
      await ctx.reply("Anda memilih presensi <b>"+pertemuan+"</b>\nStatus: "+resp[0]["pesan"]+emoji,
      {
        parse_mode:'HTML',
        reply_markup: {inline_keyboard: [[ { text: "Buka Zoom/Meet", url: resp[0]["urlMeet"] } ]]}
      });
      await ctx.replyWithSticker(sticker);
      return isSuccess;
		});
	} catch (e) {
		console.log(e);
    return false;
	}
}
async function pertemuan(link, makul,ctx){
  var dataPertemuan = [];
  await ctx.reply("Anda memilih matakuliah <b>"+makul+"</b>",{parse_mode:'HTML'});
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

module.exports = {
  authLogin,
	absenkan,
  pertemuan,
  absensiBerlangsung,
	absensiMakul
}
