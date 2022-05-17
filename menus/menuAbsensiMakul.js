const axios = require('axios');
const cheerio = require('cheerio');

const absensiMKObj = {
	url: "https://ocw.uns.ac.id/course/",
	async absensiMK(strCookie,hasCookie,ctx){
		var dataMakul = [{"data":[],"status":false}];
    try{
			var config = {
				headers: {"Cookie": strCookie},
				responseType: 'html'
			};
			if(!hasCookie){// stopped proccess
				return dataMakul;
			}
			console.log(`${ctx.from.first_name} navigate to menu absensi per-makul...`);
			await ctx.reply("Sedang mengambil data makul...");
			const response = await axios.get(this.url,config);
			const $ = cheerio.load(response.data);
			let cardMKElement = $('li#daftar-makul > ul.nav');
			var nomor = 0;
			$(cardMKElement).find('li.daftar-makul').each(function (index, element) { // section loop pertemuan
				nomor++;
				let spanTxt = $(element).find('span').last().text().trim();
				let link = $(element).find('a').attr('href');
							spanTxt = spanTxt.split(' - ');
				let mk =  spanTxt[0];
				let pengampu = spanTxt[1];
				let kelas = spanTxt[2];
        // get mk, kodemk, pengampu, kelas
        let paramsMK = {
					"no":nomor,
					"nama_mk":mk,
					"pengampu":pengampu,
					"kelas":kelas,
					"link":process.env.OCW_URL+link
				};

        dataMakul[0].data.push(paramsMK);
      });
			dataMakul[0].status = true;
			await ctx.reply("Berhasil mengambil data makul");
    }catch(e){
			dataMakul[0].status = false;
			await ctx.reply("Gagal mengambil data makul, session login telah habis\nSilakan ulangi perintah /absenmakul");
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
	async registerMK(strCookie,hasCookie,ctx){
		var dataMakul = [{"data":[],"status":false}];
    try{
			var config = {
				headers: {"Cookie": strCookie},
				responseType: 'html'
			};
			if(!hasCookie){// stopped proccess
				return dataMakul;
			}
			console.log(`${ctx.from.first_name} navigate to menu register makul...`);
			await ctx.reply("Sedang meregistrasi makul anda ke group...");
			const response = await axios.get(this.url,config);
			const $ = cheerio.load(response.data);

			// register new link (for presence)
			var dataNewLink = [];
			let cardMKElement = $('li#daftar-makul > ul.nav');
			$(cardMKElement).find('li.daftar-makul').each(function (index, element) {
				let spanTxt = $(element).find('span').last().text().trim();
				let link = $(element).find('a').attr('href');
							spanTxt = spanTxt.split(' - ');
				let mk =  spanTxt[0];
				let pengampu = spanTxt[1].split(' ');
				let kelas = spanTxt[2].split(' ');

				let slugmakul = `${mk} ${pengampu[0]} ${kelas[1]}`;
				let newSlugmk = slugmakul.replace(/ /g,'-').toLowerCase();
        let paramsMK = {"slugmakul":newSlugmk,"link":process.env.OCW_URL+link};
				dataNewLink.push(paramsMK);
			});

			// register all params
			var prodi = $('ul.dropdown-menu').find('p > span.label').text().trim();
			var boxMkElement = $('.assignment-index');

			const getNewLink = (dataLink,valSlug) => {
				let data = dataLink.filter(el => el["slugmakul"] == valSlug);
				return data[0]["link"];
			};
			$(boxMkElement).find('.col-lg-4.col-sm-6').each(function (index, element) { // section loop pertemuan
				let link = $(element).find('a').attr('href');
				let kodemk = $(element).find('.numbers > h6').last().text().trim();
				let mk = $(element).find('.numbers > h6').first().text().trim();
				let statsText = $(element).find('.stats').text().trim();
				let newStats = statsText.split(/Pengampu : | Kelas : | SKS : /g);
        var pengampu = newStats[1].trim();
        var kelas = newStats[2];

				let splitPengampu = pengampu.split(' ');
				let slugmakul = `${mk} ${splitPengampu[0]} ${kelas}`;
				let newLink = getNewLink(dataNewLink,slugmakul.replace(/ /g,'-').toLowerCase());
				let newSlugmk = `${kodemk} ${mk} ${splitPengampu[0]} ${kelas}`; // format selected
        let paramsMK = {
					"slugmakul":newSlugmk.replace(/ /g,'-').toLowerCase(),
					"kode_mk":kodemk,
					"nama_mk":mk,
					"dosen":pengampu,
					"kelas":kelas,
					"prodi":prodi,
					"link":newLink
				};

        dataMakul[0].data.push(paramsMK);
      });
			dataMakul[0].status = true;
			await ctx.reply("Berhasil meregistrasi makul anda di group");
    }catch(e){
			console.log(e);
			dataMakul[0].status = false;
			await ctx.reply("Gagal meregistrasi makul ke group, session login telah habis\nSilakan ulangi perintah /registermk");
    }
		return dataMakul;
  },
}
module.exports = absensiMKObj;
