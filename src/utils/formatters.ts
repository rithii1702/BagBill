// Indian Rupee formatting utility
export function formatINR(
  amount: number | null | undefined, 
  showSymbol: boolean = true, 
  forceDecimals: boolean = false
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return showSymbol ? (forceDecimals ? '₹0.00' : '₹0') : (forceDecimals ? '0.00' : '0');
  }

  const rounded = Math.round(amount * 100) / 100;
  const isNegative = rounded < 0;
  const absAmount = Math.abs(rounded);

  const parts = absAmount.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = forceDecimals ? `.${parts[1]}` : (parts[1] === '00' ? '' : `.${parts[1]}`);

  // Indian comma separation format: last 3 digits, then groups of 2
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const rest = integerPart.substring(0, integerPart.length - 3);
    integerPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  const formatted = `${integerPart}${decimalPart}`;
  const sign = isNegative ? '-' : '';

  return showSymbol ? `${sign}₹${formatted}` : `${sign}${formatted}`;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
