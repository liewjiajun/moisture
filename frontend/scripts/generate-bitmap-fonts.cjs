/**
 * Bitmap Font Generator for Phaser 3
 * Generates PNG atlas + XML font data from Press Start 2P font
 */

const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;\'"-+=/\\()[]{}@#$%&*<>~_ ';
const FONT_SIZES = [8, 12, 16];
const OUTPUT_DIR = path.join(__dirname, '../public/assets/fonts');
const FONT_DIR = path.join(__dirname, '../node_modules/.fonts');

// Download Press Start 2P font from Google Fonts
async function downloadFont() {
  const fontPath = path.join(FONT_DIR, 'PressStart2P-Regular.ttf');

  if (fs.existsSync(fontPath)) {
    console.log('Font already downloaded');
    return fontPath;
  }

  console.log('Downloading Press Start 2P font...');

  // Create fonts directory
  fs.mkdirSync(FONT_DIR, { recursive: true });

  // Google Fonts direct download URL
  const fontUrl = 'https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf';

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(fontPath);

    const request = (url) => {
      https.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          request(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download font: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('Font downloaded successfully');
          resolve(fontPath);
        });
      }).on('error', (err) => {
        fs.unlink(fontPath, () => {}); // Delete partial file
        reject(err);
      });
    };

    request(fontUrl);
  });
}

// Generate bitmap font for a specific size
function generateBitmapFont(fontSize, fontPath) {
  console.log(`Generating ${fontSize}px bitmap font...`);

  // Register the font
  registerFont(fontPath, { family: 'PressStart2P' });

  // Calculate canvas size - arrange characters in a grid
  const charsPerRow = 16;
  const padding = 2;
  const charWidth = fontSize + padding;
  const charHeight = fontSize + padding;
  const rows = Math.ceil(CHARACTERS.length / charsPerRow);
  const canvasWidth = nextPowerOf2(charsPerRow * charWidth);
  const canvasHeight = nextPowerOf2(rows * charHeight);

  // Create canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Clear with transparent background
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Set font
  ctx.font = `${fontSize}px PressStart2P`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';

  // Character metrics for XML
  const charData = [];

  // Draw each character
  for (let i = 0; i < CHARACTERS.length; i++) {
    const char = CHARACTERS[i];
    const col = i % charsPerRow;
    const row = Math.floor(i / charsPerRow);
    const x = col * charWidth + 1;
    const y = row * charHeight + 1;

    // Measure character width
    const metrics = ctx.measureText(char);
    const actualWidth = Math.ceil(metrics.width) || fontSize;

    // Draw character
    ctx.fillText(char, x, y);

    // Store character data
    charData.push({
      id: char.charCodeAt(0),
      char: char,
      x: x,
      y: y,
      width: actualWidth,
      height: fontSize,
      xoffset: 0,
      yoffset: 0,
      xadvance: actualWidth + 1,
    });
  }

  // Save PNG
  const pngPath = path.join(OUTPUT_DIR, `pixel-${fontSize}.png`);
  const pngBuffer = canvas.toBuffer('image/png');
  fs.writeFileSync(pngPath, pngBuffer);
  console.log(`  Saved: ${pngPath}`);

  // Generate XML
  const xml = generateXML(fontSize, canvasWidth, canvasHeight, charData);
  const xmlPath = path.join(OUTPUT_DIR, `pixel-${fontSize}.xml`);
  fs.writeFileSync(xmlPath, xml);
  console.log(`  Saved: ${xmlPath}`);
}

// Generate Phaser-compatible XML
function generateXML(fontSize, width, height, charData) {
  const lines = [
    '<?xml version="1.0"?>',
    '<font>',
    `  <info face="pixel-${fontSize}" size="${fontSize}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="0" aa="0" padding="0,0,0,0" spacing="1,1"/>`,
    `  <common lineHeight="${fontSize}" base="${fontSize}" scaleW="${width}" scaleH="${height}" pages="1" packed="0"/>`,
    '  <pages>',
    `    <page id="0" file="pixel-${fontSize}.png"/>`,
    '  </pages>',
    `  <chars count="${charData.length}">`,
  ];

  for (const char of charData) {
    lines.push(`    <char id="${char.id}" x="${char.x}" y="${char.y}" width="${char.width}" height="${char.height}" xoffset="${char.xoffset}" yoffset="${char.yoffset}" xadvance="${char.xadvance}" page="0" chnl="15"/>`);
  }

  lines.push('  </chars>');
  lines.push('  <kernings count="0"/>');
  lines.push('</font>');

  return lines.join('\n');
}

// Helper: next power of 2
function nextPowerOf2(n) {
  let power = 1;
  while (power < n) power *= 2;
  return power;
}

// Main
async function main() {
  try {
    // Ensure output directory exists
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Download font
    const fontPath = await downloadFont();

    // Generate each size
    for (const size of FONT_SIZES) {
      generateBitmapFont(size, fontPath);
    }

    console.log('\nDone! Bitmap fonts generated successfully.');
    console.log(`Output: ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
