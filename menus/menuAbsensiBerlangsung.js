const date = require('date-and-time');
const axios = require('axios');
const cheerio = require('cheerio');
const {b64, timestamp, convertTZ, utils} = require('../utils/myUtils');

const absensiObj = {
	url:"https://ocw.uns.ac.id/presensi-online-mahasiswa/kuliah-berlangsung",
	async cekAbsensi(strCookie,hasCookie,ctx){
		var dataPresensi = [{"pertemuan":[],"pesan":[]}];
		var dataAbsen = [];
		try{
			var config = {
				headers: {"Cookie": strCookie},
				responseType: 'html'
			};
			if(!hasCookie){// stopped proccess
				return dataPresensi;
			}
      console.log(`${ctx.from.first_name} navigate to menu absensi berlangsung...`);
			await ctx.reply("Sedang mengambil data presensi...");
			const response = await axios.get(this.url,config);
			const $ = cheerio.load(response.data);

			var elemBoxKB = '.wrapper > .main-panel > .content > .container-fluid > .row > .row > .col-md-12 > .card > .content';
			let valContent = $(elemBoxKB).text();
					valContent = valContent.trim();

			if(valContent == "Tidak ada kuliah berlangsung saat ini"){
				dataPresensi[0]["pesan"].push("<b>Cie Gak Ada Absen</b>");
			}else{
				elemBoxKB += ' > .row > .col-md-6';
				let colBoxKB = $(elemBoxKB);
				if(colBoxKB.length > 0){
					for(var i=1; i<=colBoxKB.length; i++){
						var contenBoxKB = elemBoxKB+':nth-child('+i+') > .panel-default';
						let valMK = $(contenBoxKB+' > .panel-body > p > b').text();
						let valWaktu =  $(contenBoxKB+' > .panel-body').find('small').first().text();
						let valDosen =  $(contenBoxKB+' > .panel-body').find('small').last().text();
						let status = $(contenBoxKB+' > .panel-body').children("p").last().text();
								status = status.trim();
						let warna = (status == 'Anda Belum Presensi') ? 'merah':'hijau';
						let link = "";
						if(warna == 'merah'){
								link = $(contenBoxKB+' > .panel-body > p > a.btn').attr("href");
						}
		        let paramsAbsen = {
							"nama_mk":valMK,
							"waktu":valWaktu,
							"dosen":valDosen,
							"warna":warna,
							"link":process.env.OCW_URL+link
						};
		        dataAbsen.push(paramsAbsen);
					}
				}
			}
			await ctx.reply("Berhasil mengambil data presensi");
			var dtTxtId = [];
			for(var k=0; k<dataAbsen.length; k++){ // section loop tiap makul
				let tmpMsg = "";
				var slugMakul = dataAbsen[k]["nama_mk"]+' - ['+dataAbsen[k]["dosen"]+'] ';
				if(dataAbsen[k]['warna'] == 'merah'){
					tmpMsg += "⚠️ <b>BELUM ABSEN</b> untuk MK: "+dataAbsen[k]["nama_mk"]+ " [" +dataAbsen[k]["dosen"]+"] jam "+dataAbsen[k]["waktu"]+" (";
					var tmpValPertemuan = [];
					var nomor = 0;
					var config = {
						headers: {"Cookie": strCookie},
						responseType: 'html'
					};
					const resp = await axios.get(dataAbsen[k]["link"],config);
					const $ = cheerio.load(resp.data);
					let mkKelas = $('.heading-kelas').find('.kelas').text().trim();
					var kelas = mkKelas.substr(mkKelas.length-1);
					const elemBoxPresensi = '.col-md-12 > .card > .content > .row';
					$(elemBoxPresensi).find('.col-md-6').each(function (index, element) { // section loop pertemuan
						let valTgl = $(element).find('small').first().text();
						const now = new Date();
						let tglNow = date.format(convertTZ(now, "Asia/Jakarta"),'YYYY-MM-DD');
						// if(valTgl == '2022-05-17' || valTgl == '2022-03-22' || valTgl == '2022-03-08'){
						if(valTgl == tglNow){
							const valPertemuan = $(element).find('p').first().text();
							const link = $(element).find('a.btn').attr('href');
							tmpValPertemuan.push(valPertemuan);

							let splitMakul = dataAbsen[k]["nama_mk"].split('-');
							let newMakul = splitMakul[1].trim();
							let kodemk = splitMakul[0].trim();
							let splitPengampu = dataAbsen[k]["dosen"].split(' ');
							let strSlug = `${kodemk} ${newMakul} ${splitPengampu[0]} ${kelas}`;
							let newSlugmk = strSlug.replace(/ /g,'-').toLowerCase();

							const indexSearch = link.indexOf("id=");
							const txtID = link.substring(indexSearch+3,link.length);
							let pilihanAbsen = {"pertemuan":valPertemuan,"id":txtID,"makul":slugMakul,"slugmakul":newSlugmk};
							dataPresensi[0]["pertemuan"].push(pilihanAbsen);
							dtTxtId.push(txtID);
						}
					});
					tmpMsg += (tmpValPertemuan.length > 0) ? tmpValPertemuan.join(', ')+")" : "-)";
				}else if(dataAbsen[k]['warna'] == 'hijau'){
					tmpMsg += "✅  <b>SUDAH ABSEN</b> untuk MK: "+dataAbsen[k]["nama_mk"]+ " [" +dataAbsen[k]["dosen"]+"] "+ "jam "+dataAbsen[k]["waktu"];
				}
				// push text message
				dataPresensi[0]["pesan"].push(tmpMsg);
			}
			if(dtTxtId.length > 1){ // add menu all absen if more than 1
				const reducer = (accumulator, curr) => accumulator + ","+curr;
				const arrTxtId = dtTxtId.reduce(reducer);
				let newParams = {"pertemuan":"semua","id":arrTxtId,"makul":"Absenkan","slugmakul":"-"};
				dataPresensi[0]["pertemuan"].push(newParams);
			}
		}catch(e){
			console.log(e);
			await ctx.reply("Gagal mengambil data presensi, session login telah habis.\nSilakan ulangi perintah /gasabsen");
		}
		return dataPresensi;
	},
	async prosesRequest(URLs,strCookie){
		var dataLog = [];
		try {
				await this.requestAllData(URLs,strCookie)
					.then(async res => {
						var resp = res[0];
						let isUrl = await utils.isValidURL(resp.url);
            const now = new Date();
						var dtResponse ={
							"waktu":date.format(convertTZ(now, "Asia/Jakarta"),'DD/MM/YYYY HH:mm:ss'),
							"id":resp.item,
							"urlMeet":(isUrl) ? resp.url : resp.urlGet // urlGet: ocw.xxx?id=TVRxxx
						};
						var response = resp.data;
						if('status' in response){
							dtResponse.status=response.status;
							dtResponse.pesan=response.message;
							dtResponse.keterangan=response.name;
						}else{
							dtResponse.status=response.code;
							dtResponse.pesan=response.data;
							dtResponse.keterangan=response.description;
						}
						dataLog.push(dtResponse);
					}).catch( e=> {
						console.log(e);
					});
		} catch (e) {
			console.log(e);
		}
		return dataLog;
	},
	async requestAllData(URLs,strCookie){
		let url = 'https://siakad.uns.ac.id/services/v1/presensi/update-presensi-mhs-daring?id=';
		const newUrl = URLs.map(elem => ( {...elem,"url":url+b64('decode',elem["item"])} ));
		return Promise.all(newUrl.map(e => this.postData(e["url"],e["params"],e["item"],strCookie)));
	},
	async postData(URL,params,item,strCookie){
		let urlGetID = 'https://ocw.uns.ac.id/presensi-online-mahasiswa/lakukan-presensi-mbkm?id='+item;
		var config = {
			headers: {"Cookie": strCookie},
			responseType: 'html'
		};
		return axios.all([
			  axios.post(URL,params),
			  axios.get(urlGetID,config) // get url meet
			])
	    .then(responseArr => {
				const $ = cheerio.load(responseArr[1].data);
		  	let urlMeet = $('.container-fluid > .row > div.row:nth-child(2) > .col-md-12 > .card > .content > table.table > tbody > tr:nth-child(4) > td:nth-child(2) > a').text();
				return {
	        success: true,
	        data: responseArr[0].data,
					item: item,
					url: urlMeet.trim(),
					urlGet:urlGetID
	      };
	    })
	    .catch(function(error) {
	      return { success: false, data:[],item: item };
	    });
		}
}

module.exports = absensiObj;
