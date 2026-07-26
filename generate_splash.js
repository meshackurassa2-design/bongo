const { createCanvas } = require('canvas');
const fs = require('fs');

const width = 1242;
const height = 2688;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = '#0A0A0F';
ctx.fillRect(0, 0, width, height);

// Text
ctx.fillStyle = '#D4AF37';
ctx.font = 'bold 90px "Arial", sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Bongo Streaming', width / 2, height / 2);

// Save
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./assets/splash-text.png', buffer);
console.log('Splash screen generated at ./assets/splash-text.png');
