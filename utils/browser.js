const puppeteer = require('puppeteer');
async function startBrowser(){
	let browser;
	try {
	    browser = await puppeteer.launch({
					// headless:false,
	        args: [
						'--no-sandbox',
						'--disable-setuid-sandbox',
						'--aggressive-cache-discard',
						'--disable-cache',
						'--disable-application-cache',
						'--disable-offline-load-stale-cache',
						'--disable-gpu-shader-disk-cache',
						'--media-cache-size=0',
						'--disk-cache-size=0'],
	        'ignoreHTTPSErrors': true
	    });
	} catch (err) {
	    console.log("Could not create a browser instance => : ", err);
	}
	return browser;
}
module.exports = {startBrowser};
