// Converts numbers to Indian currency words format
const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertGroup(n: number): string {
  let output = '';
  if (n >= 100) {
    output += units[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    output += tens[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    output += units[n] + ' ';
  }
  return output.trim();
}

export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';

  const rounded = Math.round(amount * 100) / 100;
  const wholePart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - wholePart) * 100);

  if (wholePart === 0 && decimalPart === 0) return 'Rupees Zero Only';

  let n = wholePart;
  let words = '';

  // Crores
  const crores = Math.floor(n / 10000000);
  if (crores > 0) {
    words += convertGroup(crores) + ' Crore ';
    n %= 10000000;
  }

  // Lakhs
  const lakhs = Math.floor(n / 100000);
  if (lakhs > 0) {
    words += convertGroup(lakhs) + ' Lakh ';
    n %= 100000;
  }

  // Thousands
  const thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    words += convertGroup(thousands) + ' Thousand ';
    n %= 1000;
  }

  // Hundreds
  const hundreds = Math.floor(n / 100);
  if (hundreds > 0) {
    words += convertGroup(hundreds) + ' Hundred ';
    n %= 100;
  }

  // Remaining tens and units
  if (n > 0) {
    if (words !== '') words += 'and ';
    words += convertGroup(n) + ' ';
  }

  words = words.trim();
  let result = words ? `Rupees ${words}` : '';

  if (decimalPart > 0) {
    const paiseWords = convertGroup(decimalPart);
    result += ` and ${paiseWords} Paise`;
  }

  return `${result} Only`;
}
