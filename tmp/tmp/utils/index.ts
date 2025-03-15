import { ethers } from "ethers";

const toHex = (covertThis: string | number | ethers.BigNumber, padding: number) => {
  if (typeof covertThis === "number") {
    covertThis = ethers.BigNumber.from(covertThis); // Convert number to BigNumber
  }
  return ethers.utils.hexZeroPad(ethers.utils.hexlify(covertThis), padding);
};


export const createERCDepositData = (
    tokenAmountOrID: any,
    recipientAddress: string,
    lenRecipientAddress: any,
  ) => {
    return (
      "0x" +
      toHex(tokenAmountOrID, 32).substring(2) + // Token amount or ID to deposit (32 bytes)
      toHex(lenRecipientAddress, 32).substring(2) + // len(recipientAddress)          (32 bytes)
      recipientAddress.substring(2)
    ); // recipientAddress               (?? bytes)
  };

const deposit =  createERCDepositData(10, "0x257E64fBaC41A29622E64E0D549dBe3dCdbfD914", 20);
console.log(deposit);