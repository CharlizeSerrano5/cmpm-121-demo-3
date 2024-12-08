export default function roundNumber(number: number) {
  // https://www.geeksforgeeks.org/how-
  // to-parse-float-with-two-decimal-places-in-javascript/
  return parseFloat(number.toFixed(4));
}
