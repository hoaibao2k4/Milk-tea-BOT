const getPriceBySize = (item, size) => {
  if (size === "M") return item.priceM;
  if (size === "L") return item.priceL;
  return 0;
};

module.exports = { getPriceBySize };
