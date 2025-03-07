import { ethers } from "ethers";

const createResourceID = (contractAddress: string, domainID: number) => {
  // Ensure contractAddress is properly formatted (remove '0x' if present)
  const cleanAddress = contractAddress.toLowerCase().replace('0x', '');
  const domainHex = ethers.utils.hexZeroPad(ethers.BigNumber.from(domainID).toHexString(), 1).slice(2);
  const combined = cleanAddress + domainHex;
  const resourceID = ethers.utils.hexZeroPad('0x' + combined, 32);
  const args = ethers.utils.hexlify(Number(18))
  console.log(args);
};

createResourceID("0x257E64fBaC41A29622E64E0D549dBe3dCdbfD914", 1);