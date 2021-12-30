const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");
const { get } = require("lodash");

const OG_IMAGES_DIRECTORY_PATH = './og-images/images';

const template = path.resolve(__dirname, 'templates/index.html');

const getThemes = () => {
	const absoluteSource = './themes';

	return fs
		.readdirSync( absoluteSource, { withFileTypes: true } )
		.filter( ( dirent ) => dirent.isDirectory() )
		.map( ( dirent ) => dirent.name );
};

async function updateTemplateWithDetails( page, themeDetails ) {

    const {
        name,
        screenshot_url,
        description,
        slug
    } = themeDetails;

    const themeJSON = require(`../themes/${slug}/theme.json`);
    const colorPalette = get(themeJSON, 'settings.color.palette', []).map(color => {
        return get(color, 'color');
    }).filter(color => typeof color !== 'undefined').slice(0, 5);

    const response = await axios.get(
        'http:'  + screenshot_url,
        {
            responseType: 'arraybuffer'
        }
    );
    const buffer = Buffer.from(response.data);
    const base64encodedImage = buffer.toString('base64');

    await page.evaluate((name, description, screenshot, pallete) => {

        let shortDescription = description.length > 100 ? description.slice(0, 97).concat('...') : description;

        document.body.innerHTML = document.body.innerHTML.replace(/{{theme_title}}/g, name);
        document.body.innerHTML = document.body.innerHTML.replace(/{{theme_description}}/g, shortDescription);
        document.body.innerHTML = document.body.innerHTML.replace(/{{theme_screenshot}}/g, 'data:image/png;base64,' + screenshot);

        document.querySelector('#color-pallete-root').innerHTML = pallete.map(color => {
            return `<div class="pallete" style="--color:${color};"></div>`;
        }).join('\n')

    }, name, description, base64encodedImage, colorPalette);

}

async function main() {
    const browser = await puppeteer.launch({
        headless: true,
        'args': [
            '--no-sandbox'
        ],
    });
    

    const themes = getThemes();

    for (const theme of themes) {

        console.log('😎 On theme: ' + theme);

        const page = await browser.newPage();

        const themeDetails = require(`../themes/${theme}/details.json`);

        await page.goto(`file:${template}`, { waitUntil: 'networkidle0' });

        await page.waitForSelector('#img');

        await updateTemplateWithDetails(page, themeDetails);

        const target = await page.$('.home-container');
        const boundingBox = await target.boundingBox();

        await page.setViewport({ width: 1200, height: boundingBox.height });
        await target.screenshot({ path: path.resolve(OG_IMAGES_DIRECTORY_PATH,  theme + '.jpg') });

        await page.close()
    }

    console.log('🎉 Og image generation completed');
    await browser.close();

}

main();
