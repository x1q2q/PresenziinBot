const axios = require('axios');
const cheerio = require('cheerio');

const absensiMKObj = {
	url: "https://ocw.uns.ac.id/course/",
	async absensiMK(strCookie,hasCookie,ctx){
		var dataMakul = [{"data":[],"status":false}];
    console.log(`${ctx.from.first_name} navigate to menu absensi per-makul...`);
    const elemBoxMK = '.assignment-index > .col-lg-4.col-sm-6';
    try{
			var config = {
				headers: {"Cookie": strCookie},
				responseType: 'html'
			};
			if(!hasCookie){// stopped proccess
				return dataMakul;
			}
			await ctx.reply("Sedang mengambil data makul...");
			const response = await axios.get(this.url,config);
			const $ = cheerio.load(response.data);
			let cardMKElement = $('li#daftar-makul > ul.nav');
			var nomor = 0;
			$(cardMKElement).find('li.daftar-makul').each(function (index, element) { // section loop pertemuan
				nomor++;
				let spanTxt = $(element).find('span').last().text();
				let link = $(element).find('a').attr('href');
							spanTxt = spanTxt.split(' - ');
				let mk =  spanTxt[0];
				let pengampu = spanTxt[1];
				let kelas = spanTxt[2];
        // get mk, kodemk, pengampu, kelas
        let paramsMK = {"no":nomor,"nama_mk":mk,"pengampu":pengampu,"kelas":kelas,"link":"https://ocw.uns.ac.id"+link};
        dataMakul[0].data.push(paramsMK);
      });
			dataMakul[0].status = true;
			await ctx.reply("Berhasil mengambil data makul");
    }catch(e){
			dataMakul[0].status = false;
			await ctx.reply("Gagal mengambil data makul\nSilakan ulangi perintah /absenmakul");
    }
		return dataMakul;
  },
	async pilihPertemuan(strCookie,hasCookie,link, ctx){
		var dataPertemuan = [{"data":[],"status":false}];
    try{
			var config = {
				headers: {"Cookie": strCookie},
				responseType: 'html'
			};
			if(!hasCookie){// stopped proccess
				return dataPertemuan;
			}
			const response = await axios.get(link,config);
			const $ = cheerio.load(response.data);
			const elemBoxPresensi = '.col-md-12 > .card > .content > .row';
			$(elemBoxPresensi).find('.col-md-6').each(function (index, element) { // section loop pertemuan
				let valTgl = $(element).find('small').first().text();
				let valWaktu =  $(element).find('small').last().text();
				let valPertemuan = $(element).find('p').first().text();
				let status = $(element).find("p").last().text();
						status = status.trim();
				let link = $(element).find('a.btn').attr('href');
				let indexSearch = link.indexOf("id=");
				let txtID = link.substring(indexSearch+3,link.length);
				let pilihanAbsen = {
						"pertemuan":valPertemuan,"id":txtID,
						"link":process.env.OCW_URL+link, "item":txtID,
						"tanggal":valTgl,"jam":valWaktu,"status":status,
						"emoji":(status == "Kehadiran Anda: HADIR") ? " ✅" : " ⚠️"
				};
				dataPertemuan[0].data.push(pilihanAbsen); // push id
			});
			dataPertemuan[0].status = true;
			await ctx.reply("Berhasil mengambil data presensi");
    }catch(e){
			dataPertemuan[0].status = false;
			await ctx.reply("Gagal mengambil data presensi\nSilakan ulangi perintah /absenmakul");
    }
		return dataPertemuan;
  },
}
module.exports = absensiMKObj;
