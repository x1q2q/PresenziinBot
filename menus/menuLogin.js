const browserObj = require('../utils/browser');
const {b64, timestamp, convertTZ, utils} = require('../utils/myUtils');
const MongoDB = require('../utils/mongoUtil');

const loggedCheck = async (page) => {
    try {
        await page.waitForSelector('a.dropdown-toggle', { timeout: 10000 });
        return true;
    } catch(err) {
        return false;
    }
}
const loginObj = {
	url: 'https://ocw.uns.ac.id/saml/login',
	async login(userID){
		var dtLogin = [{"status":false,"cookie":"-"}];
    const newUser = await MongoDB.getCollection('users');
    var userProfile = await newUser.find({userid:userID}).toArray();

    var email = userProfile[0]["email"];
    var password = userProfile[0]["password"];
		return new Promise(async (resolve, reject) => {
			try{
        console.log(`${email} trying to login...`);
				const browser = await browserObj.startBrowser();
				const page = await browser.newPage();
				await page.goto(this.url,{waitUntil:'networkidle2'});
				await page.waitForSelector('button[type="submit"]', {visible: true});
				await page.type('input[name="username"]', email);
				await page.type('input[name="password"]',  b64('decode',password));
				await page.click('button[type="submit"]');
        await page.setDefaultNavigationTimeout(60000);
        await page.waitForNavigation({waitUntil:'networkidle2'});
				isLogged = await loggedCheck(page);
				if(isLogged){
					var dtCookie = await page.cookies().then(ck=> {
						let filtered = ck.filter((el, index )=> index > 0);
						let strCookie = filtered.map((el, index) => el['name']+'='+el['value']);
								strCookie = strCookie.join("; ");
						return strCookie;
					});
					// await newUser.updateOne({userid:userID},{$set:{cookie:dtCookie}});
					dtLogin[0].status = true;
          dtLogin[0].cookie = dtCookie;
					console.log(`${email} success login`);
					await browser.close();
				}else{
          dtLogin[0].status=false;
          console.log(`${email} login failed. email/passwd incorrect`);
				}
				return resolve(dtLogin);
			}catch(e){
        dtLogin[0].status = false;
        console.log(`${email} login failed. ${e}`);
				return reject('Gagal Login.\n'+e+'. Silakan ulangi lagi!');
			}
    });
	}
}

module.exports = loginObj;
