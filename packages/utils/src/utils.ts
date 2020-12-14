import { BigNumber } from 'bignumber.js';

export function amountFromWei(amount: BigNumber, precision = 18): BigNumber {
  return amount.div(new BigNumber(10).pow(precision));
}

export function amountToWei(amount: BigNumber, precision = 18): BigNumber {
  return amount.times(new BigNumber(10).pow(precision));
}

export function eth2weth(token: string): string {
  return token.replace(/^ETH/, 'WETH');
}

export function weth2eth(token: string): string {
  return token.replace(/^WETH/, 'ETH');
}

export function padLeft(str: string, chars: number, sign?: string): string {
  return Array(chars - str.length + 1).join(sign || '0') + str;
}

export const nullAddress = '0x0000000000000000000000000000000000000000';

export function storageHexToBigNumber(uint256: string): [BigNumber, BigNumber] {
  const match = uint256.match(/^0x(\w+)$/);
  if (!match) {
    throw new Error(`invalid uint256: ${uint256}`);
  }
  return match[0].length <= 32
    ? [new BigNumber(0), new BigNumber(uint256)]
    : [
        new BigNumber(`0x${match[0].substr(0, match[0].length - 32)}`),
        new BigNumber(`0x${match[0].substr(match[0].length - 32, 32)}`),
      ];
}

export function localStorageStoreDict(dict: { [index: string]: boolean }, key: string): void {
  localStorage?.setItem(key, JSON.stringify(dict));
}

export function localStorageGetDict(key: string): any {
  const dict = localStorage?.getItem(key) ?? '{}';
  return JSON.parse(dict);
}
