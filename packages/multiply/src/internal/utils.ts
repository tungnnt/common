import {ConvertableToBigNumber} from './types';
import { BigNumber } from 'bignumber.js';

const ensureBigNumber = function(candidate : ConvertableToBigNumber) : BigNumber{
    let retVal : BigNumber;
    if (typeof candidate == 'number' || typeof candidate == 'string') {
      retVal = new BigNumber(candidate);
    } else {
      if (BigNumber.isBigNumber(candidate) === false ) {
        retVal = new BigNumber(candidate.toString());
      }else{
        retVal = new BigNumber(candidate as BigNumber);
      }
    }
        
    if(retVal.isNaN()){
      throw `Conversion for BigNumber failed`
    }
    return retVal;
}

export { ensureBigNumber };
