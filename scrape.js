const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const UserPreferencesPlugin = require('puppeteer-extra-plugin-user-preferences');
const fs = require('fs');
const { parse } = require('path');

puppeteer.use(StealthPlugin());
puppeteer.use(UserPreferencesPlugin({ userPrefs: { profile: { content_settings: { exceptions: { javascript: {} } } } } }));

async function loginScreener(email, password) {
  const browser = await puppeteer.launch({ headless: false }); // Set headless to false for visibility during login
  const page = await browser.newPage();
  await page.goto('https://www.screener.in/login/');

  await page.type('input[name="username"]', email);
  await page.type('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // await page.waitForNavigation();

  return { browser, page };
}

async function crawlAndScrape(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for the table to load (adjust the wait time as needed)
  await page.waitForTimeout(3000);
  
  // Scrape Data
  const scrapeData = await page.evaluate(() => {
    const query = {};
    const h1Tag = document.querySelector('h1');
    if(!h1Tag)
      return {query};
    const name = h1Tag.innerText.trim();
    const bulkDealsTable = document.querySelector('#bulk-deals');
    const shareholdingTable = document.querySelector('#shareholdings');

    query.name = name;
    if(bulkDealsTable)
    {
      const rows = bulkDealsTable.querySelectorAll('tr');
      const data = [];
  
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const date = cells[0].innerText.trim();
        const orderType = cells[1].innerText.trim();
        const quantity = cells[2].innerText.trim();
        const price = cells[3].innerText.trim();
        data.push({ date, orderType, quantity, price });
      }
      query.bulkDealsData = data;
    }

    if(shareholdingTable)
    {
      const rows = shareholdingTable.querySelectorAll('tr');
      const data = [];

      const headerRow = rows[0].querySelectorAll('th');
      const quarters = [];
      for (let i = headerRow.length - 1; i >= 1; i--) {
        quarters.push(headerRow[i].innerText.trim());
      }
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].querySelectorAll('td');
        const companyName = cells[0].innerText.trim();
        const sharesHeldData = [];
    
        for (let j = cells.length - 1; j >= 1; j--) {
          const sharesHeld = cells[j].innerText.trim();
          sharesHeldData.push(Number(sharesHeld));
        }

        const filteredQuarters = {};
        for (let k = 0; k < quarters.length; k++) {
          if (parseFloat(sharesHeldData[k]) !== 0) {
            filteredQuarters[quarters[k]] = parseFloat(sharesHeldData[k]);
          }
        }

        data.push({ 'companyName': companyName, 'result' : [filteredQuarters]  });
  
      }
      query.shareHoldings = data;
    }
    return {query};
  
    
    
  });
  return scrapeData;
}

async function exportToJSON(data, fileName) {
  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync(`${fileName}.json`, jsonData, 'utf-8');
}

async function run() {
  try {
    const email = '*******';
    const password = '*****';

    const { browser, page } = await loginScreener(email, password);
    let detailsData = [];
    for (let i = 1; i <= 10000; i++) {
      const url = `https://www.screener.in/people/${i}/quant-mutual-fund-quant-small-cap-fund/`;
      const {query} = await crawlAndScrape(page, url);
      query.id = i;
      if(query.name)
        detailsData.push(query);

      if(i%100 == 0)
      {
        await exportToJSON(detailsData, `screener_data_${i-100}-${i}`);
        detailsData = [];
      }
    }
  

    await browser.close();
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

run();
