const axios = require('axios');
const cheerio = require('cheerio');

const rekapAbsenObj = {
	url: "https://ocw.uns.ac.id/presensi-online-mahasiswa/statistik-detail",
	async rekapAbsen(strCookie,hasCookie,ctx){
		var dataRekapabsen = [{"data":[],"status":false}];
    const elemBoxMK = '.assignment-index > .col-lg-4.col-sm-6';
    try{
			var config = {
				headers: {"Cookie": strCookie},
				responseType: 'html'
			};
			if(!hasCookie){// stopped proccess
				return dataRekapabsen;
			}
			console.log(`${ctx.from.first_name} navigate to menu rekap absen...`);
			await ctx.reply("Sedang mengambil data rekap absen...");
			const response = await axios.get(this.url,config);
			const $ = cheerio.load(response.data);
      let presentase = $('.progress-circle > span').text().trim();
      let totalHadir = $('.statistik > .row > .col-md-12 > .text-center').first().find('p > strong').text().trim();
      let totalPertemuan = $('.statistik > .row > .col-md-12 > .text-center').last().find('p > strong').text().trim();
      dataRekapabsen[0].data.push(
        {"presentase":presentase,"tot_hadir":totalHadir,"tot_pertemuan":totalPertemuan,"datarekap":[]}
      );
      let cardTable = $('.table-responsive > table.table > tbody');
			$(cardTable).find('tr').each(function (index, element) {
        if(index != 0){
          let makul = $(element).find('td:nth-child(2)').text().trim();
          let totPertemuan = $(element).find('td:nth-child(3)').text().trim();
          let jmlHadir = $(element).find('td:nth-child(4)').text().trim();
          let jmlAlpha = $(element).find('td:nth-child(5)').text().trim();
          let jmlIjin = $(element).find('td:nth-child(6)').text().trim();
          let jmlSakit = $(element).find('td:nth-child(7)').text().trim();

          var paramsRekap = {
            "makul":makul,
            "tot_pertemuan":totPertemuan,
            "jml_hadir":jmlHadir,
            "jml_alpha":jmlAlpha,
            "jml_ijin":jmlIjin,
            "jml_sakit":jmlSakit
          };
          dataRekapabsen[0].data[0].datarekap.push(paramsRekap);
        }
      });

			dataRekapabsen[0].status = true;
			await ctx.reply("Berhasil mengambil data rekap absen");
    }catch(e){
      dataRekapabsen[0].status = false;
			await ctx.reply("Gagal mengambil data rekap absen, session login telah habis\nSilakan ulangi perintah /rekapabsen");
    }
		return dataRekapabsen;
  }
}
module.exports = rekapAbsenObj;
