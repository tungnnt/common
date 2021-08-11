import { BigNumber } from 'bignumber.js';
import { ensureBigNumber } from './utils';

type ConvertableToBigNumber = number | string | BigNumber | Object;

class MarketParams {
    public oraclePrice: BigNumber;
    public marketPrice: BigNumber;
    public FF: BigNumber;
    public OF: BigNumber;
    public slippage: BigNumber;
    constructor(_oracleP:ConvertableToBigNumber, 
      _marketP : ConvertableToBigNumber, 
      _FF: ConvertableToBigNumber, 
      _OF : ConvertableToBigNumber, 
      _slip:ConvertableToBigNumber){
          this.oraclePrice = ensureBigNumber(_oracleP);
          this.marketPrice = ensureBigNumber(_marketP);
          this.FF = ensureBigNumber(_FF);
          this.OF = ensureBigNumber(_OF);
          this.slippage = ensureBigNumber(_slip);
    }
}
class VaultInfo {
     public currentDebt: BigNumber;
     public currentCollateral: BigNumber;
     constructor(_debt:ConvertableToBigNumber, 
      _coll:ConvertableToBigNumber){
        this.currentDebt = ensureBigNumber(_debt);
        this.currentCollateral = ensureBigNumber(_coll);
     }
}
class DesiredCDPState {

     public requiredCollRatio: BigNumber;
     public providedCollateral: BigNumber;
     public providedDai: BigNumber;
     public withdrawDai: BigNumber;
     public withdrawColl: BigNumber;

     constructor(_reqRatio:ConvertableToBigNumber, 
                 _providedColl:ConvertableToBigNumber, 
                 _providedDai:ConvertableToBigNumber, 
                 _withdrawDai: ConvertableToBigNumber, 
                 _withdrawColl: ConvertableToBigNumber){
           this.providedCollateral = ensureBigNumber(_providedColl);
           this.requiredCollRatio = ensureBigNumber(_reqRatio);
           this.providedDai = ensureBigNumber( _providedDai);
           this.withdrawColl = ensureBigNumber(_withdrawColl);
           this.withdrawDai = ensureBigNumber( _withdrawDai);
     }
}
export type { ConvertableToBigNumber };
export {  VaultInfo, MarketParams, DesiredCDPState }