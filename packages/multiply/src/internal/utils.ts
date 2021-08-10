import {ConvertableToBigNumber} from './types';
import { BigNumber } from 'bignumber.js';

const ensureBigNumber = function(candidate : ConvertableToBigNumber) : BigNumber{
    let retVal : BigNumber;
    try {
          if (typeof candidate == 'number' || typeof candidate == 'string') {
            retVal = new BigNumber(candidate)
          } else {
            if (BigNumber.isBigNumber(candidate) == false || candidate.hasOwnProperty('toFixed') == false) {
              retVal = new BigNumber(candidate.toString())
            }else{
              if(BigNumber.isBigNumber(candidate)){
                retVal = candidate;
              }else{
                throw "not impemented";
              }
            }
          }
        } catch (ex) {
          console.log(ex)
          throw `Conversion for BigNumber failed`
        }
    return retVal;
}

export { ensureBigNumber };
