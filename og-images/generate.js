const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");
const { get } = require("lodash");
const { parse } = require("node-html-parser");

const OG_IMAGES_DIRECTORY_PATH = "./og-images/images";

const template = path.resolve(__dirname, "templates/index.html");

const getThemes = () => {
  const absoluteSource = "./themes";

  return fs
    .readdirSync(absoluteSource, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
};

const getThemeStyles = async (slug) => {
  try {
    let indexPath = path.resolve(__dirname, `../themes/${slug}/index.html`);

    if (fs.existsSync(indexPath)) {
      let themeDemo = fs.readFileSync(
        path.resolve(__dirname, `../themes/${slug}/index.html`),
        "utf8"
      );
      let parsedStyles = parse(themeDemo)
        .querySelectorAll("link, style")
        .map((styleElem) => styleElem.outerHTML)
        .join("");
      return parsedStyles;
    }
  } catch (err) {
    console.log("Template index not found for: ", slug);
    return [];
  }
};

async function updateTemplateWithDetails(page, themeDetails) {
  try {
    const { name, screenshot_url, description, slug } = themeDetails;

    const themeJSONPath = `../themes/${slug}/theme.json`;

    if (!fs.existsSync(path.resolve(__dirname, themeJSONPath))) {
      console.log("🚫 Theme json not found for: ", slug);

      const leftoversJSONPath = path.resolve(
        __dirname,
        `../data/leftovers.json`
      );

      const leftoversJSON = require(leftoversJSONPath);
      leftoversJSON.push(slug);
      fs.writeFileSync(
        leftoversJSONPath,
        JSON.stringify(leftoversJSON, null, 2)
      );
      return false;
    }

    const themeJSON = require(themeJSONPath);

    const themeStyles = await getThemeStyles(slug);

    const colorPalette = get(themeJSON, "settings.color.palette", [])
      .map((color) => {
        return get(color, "color");
      })
      .filter((color) => typeof color !== "undefined")
      .slice(0, 5);

    const response = await axios.get("http:" + screenshot_url, {
      responseType: "arraybuffer",
    });
    const buffer = Buffer.from(response.data);
    const base64encodedImage = buffer.toString("base64");

    // Adding theme styles
    await page.evaluate((styles) => {
      document.querySelector("head").innerHTML += styles;
    }, themeStyles);

    await page.evaluate(
      (name, description, screenshot, pallete) => {
        let shortDescription =
          description.length > 100
            ? description.slice(0, 97).concat("...")
            : description;

        document.body.innerHTML = document.body.innerHTML.replace(
          /{{theme_title}}/g,
          name
        );
        document.body.innerHTML = document.body.innerHTML.replace(
          /{{theme_description}}/g,
          shortDescription
        );
        document.body.innerHTML = document.body.innerHTML.replace(
          /{{theme_screenshot}}/g,
          "data:image/png;base64," + screenshot
        );

        if (pallete.length === 0) {
          document.querySelector(".home-colorscheme731").style.border = "";
        }

        document.querySelector("#color-pallete-root").innerHTML = pallete
          .map((color) => {
            return `<li class="pallete" style="--color:${color};"></li>`;
          })
          .join("\n");
      },
      name,
      description,
      base64encodedImage,
      colorPalette
    );

    return true;
  } catch (error) {
    console.error("🛑 Something went wrong... Skipping");

    const leftoversJSONPath = path.resolve(__dirname, `../data/leftovers.json`);

    const leftoversJSON = require(leftoversJSONPath);
    leftoversJSON.push(themeDetails.slug);
    fs.writeFileSync(leftoversJSONPath, JSON.stringify(leftoversJSON, null, 2));

    return false;
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });

  let themes = getThemes();
  let totalThemeCount = themes.length;
  const processOnlyNew = process.argv.includes("only-new");

  for (const [index, theme] of themes.entries()) {
    const themeStoragePath = path.resolve(
      OG_IMAGES_DIRECTORY_PATH,
      theme + ".jpg"
    );

    const isAlreadyDone = fs.existsSync(themeStoragePath);

    if (isAlreadyDone && processOnlyNew) {
      console.log(`🤞 OK, Skpping ${theme} because it was already done.`);
      continue;
    }

    console.log(`${index}/${totalThemeCount} 😎 On Theme: `, theme);

    const page = await browser.newPage();

    const themeDetails = require(`../themes/${theme}/details.json`);

    await page.goto(`file:${template}`, { waitUntil: "networkidle2" });

    await page.waitForSelector("#img");

    const isUpdated = await updateTemplateWithDetails(page, themeDetails);

    console.log({ isUpdated });

    if (isUpdated) {
      const target = await page.$(".home-container");
      const boundingBox = await target.boundingBox();

      await page.setViewport({ width: 1200, height: boundingBox.height });
      await target.screenshot({
        path: path.resolve(OG_IMAGES_DIRECTORY_PATH, theme + ".jpg"),
      });
    }

    await page.close();
  }

  console.log("🎉 Og image generation completed");
  await browser.close();
}

main();
