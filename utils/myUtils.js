const URL = require("url").URL;
const base64 = require('base-64');
const date = require('date-and-time');
const MongoDB = require('./mongoUtil');

// func global
const b64 = (tipe,str) => {
  var trueb64 = "";
  var b64temp = str;
  var count = process.env.B64;
  for(var i=0; i < parseInt(count); i++){
    b64temp = (tipe == 'encode') ? base64.encode(b64temp): base64.decode(b64temp);
    trueb64 = b64temp;
  }
  return trueb64;
}
const timestamp = (now) => {
  return date.format(now,'DD-MM-YYYY HH:mm:ss');
}
const convertTZ = (date, tzString) => {
  return new Date((typeof date === "string" ? new Date(date) : date).toLocaleString("en-US", {timeZone: tzString}));
}
const expired = (now, tipe, sum) => {
  switch (tipe) {
    case 'month':
      return date.addMonths(now, sum)
      break;

    case 'day':
      return date.addDays(now, sum)
      break;

    case 'hours':
      return date.addHours(now, sum)
      break;

    default:
      return date.addMinutes(now, sum)
      break;
  }
}
const utils = {
	async isValidURL(str){
		try {
      new URL(str);
      return true;
    } catch (err) {
      return false;
    }
	},
	async checkCookie(userid, strCookie){
		var isDelete = false;
		try {
			if(strCookie.split(";").length != 6){
				isDelete = true;
        const newUser = await MongoDB.getCollection('users');
        await newUser.updateOne({userid:userid},{$set:{cookie:'-'}});
			}
		} catch (e) {
			console.log(e);
		}
		return isDelete;
	},
	async splitArray(array,size){
		return array.reduce((acc, _, i) => {
	    if (i % size === 0) acc.push(array.slice(i, i + size))
	    return acc
	  }, [])
	},
	async isValidEmail(email){
		var emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    var studentEmailRegexp = /student.uns/;
		if(emailRegexp.test(email)){
      return studentEmailRegexp.test(email);
    }
    return false;
	},
	async isValidNIM(nim){
		var nimRegexp = /^[a-zA-Z][0-9]/; // check if first letter is string, must contain string & number
		return (nimRegexp.test(nim));
	},
  async isValidNamaLokasi(lokasi){
		var locRegexp = /^[a-zA-Z](?=.*[a-z])[a-z\s.'-_]+$/; // check if first letter is string,
		return locRegexp.test(lokasi);
	},
	async saveSessionUser(tipe,userObj){
	  var userID = userObj.userID.toString();
	  try {
      const newUser = await MongoDB.getCollection('users');
      const newSC = await MongoDB.getCollection('secretcodes');

      const now = new Date();
      // ## save user credential ##
      // update_timestamp: digunakan ketika user update data baru & hanya diijinkan 1 kali perubahan
      // expired_in: get from secret code time_expired (+)
      let password = b64('encode',userObj.password);
      var userParams = {
          "userid":userObj.userID,
          "email":userObj.email,
          "password": password,
          "nim": userObj.nim.toUpperCase(),
      };
      if(tipe == 'register'){
        let expiredin = expired(now, userObj.expired[1], parseInt(userObj.expired[0]));
        var extraParams = { // untuk register
          "location": userObj.location,
          "code": userObj.code,
          "insert_timestamp": timestamp(convertTZ(now, "Asia/Jakarta")),
          "update_timestamp":"",
          "expired_in":timestamp(convertTZ(expiredin, "Asia/Jakarta")),
          "is_active":1,
          "cookie":"-"
        }
      }else{ // tipe edit
        var extraParams = {
          "update_timestamp":timestamp(convertTZ(now, "Asia/Jakarta"))
        }
      }
      let newParams = {...userParams, ...extraParams};

      // const newdtUsers = db('./data/users.json');
      if(tipe == 'register'){
        console.log(userObj.email+ ' berhasil mendaftar');
        await newUser.insertOne(newParams); // insert data user
        await newSC.updateOne({code:userObj.code},{$inc:{kuota_used:+1}})
      }else{
        console.log(userObj.email+ ' berhasil mengupdate data');
        await newUser.updateOne({ userid: userID }, { $set: newParams }); // update data user
      }
      return true;
	  } catch (e) {
	    console.log("error save credential ",e);
      return false;
	  }
	},
  async saveSessionLocation(locationObj){
	  var userID = locationObj.userID.toString();
	  try {
      const newUser = await MongoDB.getCollection('users');
      const newLoc = await MongoDB.getCollection('locations');

      await newUser.updateOne({userid:userID},
          {$set:{location:locationObj.namaLokasi}});

      // update location lat long
      var type = (locationObj.tipeLokasi == 'default')?'add':'edit';
      if(type == 'add'){
        let newParams = {
          "nama_lokasi":locationObj.namaLokasi,
          "latitude":locationObj.latitude,
          "longitude":locationObj.longitude,
          "type": "by_user",
          "userid": locationObj.userID
        };
        await newLoc.insertOne(newParams);
      }else{
        let newParams = {
          "nama_lokasi":locationObj.namaLokasi,
          "latitude":locationObj.latitude,
          "longitude":locationObj.longitude,
          "userid": locationObj.userID
        };
        await newLoc.updateOne({nama_lokasi:locationObj.oldLokasi},
          {$set:newParams});
      }
      return true;
	  } catch (e) {
	    console.log("error save location ",e);
      return false;
	  }
	},
  async saveToLog(logParams,userID){
	  try {
      const newUser = await MongoDB.getCollection('users');
      const newLog = await MongoDB.getCollection('logs');
      const now = new Date();

      var userProfile = await newUser.find({userid:userID}).toArray();
      var nim = userProfile[0]["nim"];
      var tglNow = date.format(convertTZ(now, "Asia/Jakarta"),'DD-MM-YYYY');
      var extraParams = {
        "kode_prodi": nim.substring(0,4),
        "by_user": userID,
        "timestamp": timestamp(convertTZ(now, "Asia/Jakarta"))
      };
      var newParams = {...logParams, ...extraParams};
      var tipeUpdate = ["check_menu","register_makul"];
      if(tipeUpdate.includes(logParams.tipe_log)){ // jika tipe lognya update maka update
        var kdLog = (logParams.tipe_log == 'check_menu') ?
                    logParams.kode_log+'|'+tglNow : logParams.kode_log;
        var dtOldLog = await MongoDB.getCollection('logs').find({kode_log:kdLog,by_user:userID}).toArray();

        if(dtOldLog.length == 0){ // jika sebelumnya blm ada utk hari ini maka insert
          if(logParams.tipe_log == 'check_menu'){
            newParams.kode_log = kdLog;
            newParams.desc = newParams.desc + ' sebanyak:1';
          }
          await newLog.insertOne(newParams);
        }else{ // jika sdh ada utk hari ini maka update
          if(logParams.tipe_log == 'check_menu'){
            var descLog = dtOldLog[0]["desc"];
            var splitLog = descLog.split(':'); // use 1 index to get int
            var incCheck = parseInt(splitLog[1])+1;
            var newDesc = logParams.desc+' sebanyak:'+incCheck.toString();
          }else{
            var newDesc = logParams.desc;
          }
          await newLog.updateOne(
            {
              $and: [
                {kode_log:kdLog},
                {by_user:userID},
              ]
            },
            {$set:{"desc":newDesc,timestamp:extraParams.timestamp}});
        }
      }else{ // jika bukan maka insert
        await newLog.insertOne(newParams);
      }
      return true;
	  } catch (e) {
	    console.log("error save log ",e);
      return false;
	  }
	},
  async sendBroadcast(broadcastParams){
    var dataPesan = [];
    try {
      var dtPenerima = broadcastParams.dataPenerima;
      var parameter = broadcastParams.parameter;
      var textMsg = broadcastParams.textMsg;

      const newdtUsers = await MongoDB.getCollection('users');
      switch (parameter) {
        case 'all':
          var dtUsers = await newdtUsers.find({}).toArray();
          break;

        case 'code':
          var dtUsers = await newdtUsers.find(
              {code : { $in : dtPenerima }}).toArray();
          break;

        case 'userid':
          var dtUsers = await newdtUsers.find(
              {userid : { $in : dtPenerima }}).toArray();
          break;

        case 'nim':
          var dtUsers = await newdtUsers.find(
              {nim : { $in : dtPenerima }}).toArray();
          break;

        default: // default untuk [all]
          var dtUsers = [];
      }
      let strHeader = '<b>📢 Pesan Siaran Baru</b>\n\n';
      let strFooter = '\n\n<i>*pesan ini disiarkan secara otomatis.</i>';
      for(let id=0; id<dtUsers.length; id++){
        let chatid = parseInt(dtUsers[id]["userid"]);
        let newTxtMsg = textMsg.replace(/{email}/g, dtUsers[id]["email"]);
        let pesan = strHeader + newTxtMsg + strFooter;
        dataPesan.push({"userid":chatid,"pesan":pesan});
      }
      return dataPesan;
    } catch (e) {
      console.log('error to broadcast ',e);
      return dataPesan;
    }
  },
  async getDataNim(slug,userID){
    var dataNim = [];
    try {
      const newUser = await MongoDB.getCollection('users');
      const newGroup = await MongoDB.getCollection('groups');
      var userProfile = await newUser.find({userid:userID}).toArray();
      var nimUser = userProfile[0]["nim"];
      var group = await newGroup.find({slugmakul:slug}).toArray();
      var groupNim = group[0]["list_nim"];
      dataNim = groupNim.filter(el => el != nimUser); // hanya broadcast selain nim sendiri
    } catch (e) {
      return dataNim;
    }
    return dataNim;
  },
  async checkExistID(userid){
    try {
      const cursor = await MongoDB.getCollection('users').countDocuments({userid:userid});
      if(cursor > 0) return true;
      return false;
    } catch (e) {
      return false;
    }
  },
  async checkExpired(userid){ // check if is expired or not
    try{
      const newUser = await MongoDB.getCollection('users');
      var userProfile = await newUser.find({userid:userid}).toArray();
      var userData = await newUser.find({}).toArray();

      var dtUsers = userData.filter(el => el['userid'] == userid);
      var expired = await userProfile[0]['expired_in'];
      const now = new Date();
      const objExpired = convertTZ(date.parse(expired, 'DD-MM-YYYY HH:mm:ss'), "Asia/Jakarta");
      const objNow = convertTZ(now, "Asia/Jakarta");
      if(expired != "" && objExpired > objNow){
        if(dtUsers[0]["is_active"] == 0){
          // walaupun belum expired tpi tetap tidak bisa karena is_active 0
          return true;
        }else{
          return false;
        }
      }else{ // ketka sudah expired
        await newUser.updateOne({userid:userid},{$set:{is_active:0}}); // set to not active
        return true;
      }
    }catch(e){
      console.log(e);
      return true; // jika error
    }
  },
  async checkExistIdAbsen(textid){ // check id absen on the log
    try {
      const cursor = await MongoDB.getCollection('logs').countDocuments({
                    $and: [
                      {kode_log:textid},
                      {tipe_log:'absen'}
                    ]});
      if(cursor > 0) return true;
      return false;
    } catch (e) {
      return false;
    }
  }
}
module.exports = {b64, timestamp, convertTZ, utils};
