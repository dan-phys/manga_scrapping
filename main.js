const { Builder, Browser, By } = require("selenium-webdriver");
const readline = require("readline");
const fs = require("fs/promises");
const { Buffer } = require("buffer");

function getInput(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function checkDirExistenceOrCreate(path) {
  try {
    await fs.access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
			await fs.mkdir(path, {recursive: true})
      return false;
    } else {
      console.error(`Error checking existence of ${path}:`, error);
      throw error;
    }
  }
}

async function saveImage(url, chapterNumber, mangaName) {
  try {
    const pageNumber = url.split("/").reverse()[0];
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const bufferData = Buffer.from(buffer);

		const dirPath = `./mangas/${mangaName}/${chapterNumber}`
    await checkDirExistenceOrCreate(dirPath)

    const savePath = `${dirPath}/${pageNumber}`;
    await fs.writeFile(savePath, bufferData);
  } catch (error) {
    console.error("Error saving image:", error);
  }
}

(async function helloSelenium() {
  const chaptersLinks = [];
  const mangaId = await getInput("Enter the manga id: ");

  const baseUrl = `https://allmanga.to/manga/${mangaId}`;

  let driver = await new Builder().forBrowser(Browser.CHROME).build();

  try {
    await driver.get(baseUrl);

		const breadcrumb = await driver.findElement(By.className("breadcrumb"))
		const mangaNameSpan = await breadcrumb.findElement(By.css("span"))

		const mangaName = await mangaNameSpan.getText()

    const container = await driver.findElement(
      By.id("chapterList-collapse-sub")
    );
    const buttonsDiv = await container.findElement(
      By.className("container mt-3 container-pagi")
    );

    const buttons = await buttonsDiv.findElements(By.css("button"));
    buttons.reverse();

    for (let button of buttons) {
      await button.click();

      const linksDiv = await container.findElement(
        By.className("d-flex justify-content-center link-7 flex-row flex-wrap")
      );
      const links = await linksDiv.findElements(By.css("a"));
      links.reverse();

      for (let link of links) {
        const chapterLink = await link.getAttribute("href");
        chaptersLinks.push(chapterLink);
      }
    }

		let chapterNumber = 0
		for (let link of chaptersLinks) {
			chapterNumber++
			const imagesUrl = []
			await driver.get(link);

			const imagesContainer = await driver.findElement(By.id("pictureViewer"))

			const images = await imagesContainer.findElements(By.css("img"))

			for (let image of images) {
				const imageUrl = await image.getAttribute("data-src")
				imagesUrl.push(imageUrl)
			}

			await Promise.all(imagesUrl.map((url) => saveImage(url, chapterNumber, mangaName)))

			if (chapterNumber === 3) break;
		}
  } catch (error) {
    console.log(error);
  } finally {
    await driver.quit();
  }
})();