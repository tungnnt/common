import { BigNumber } from 'bignumber.js';
import { DesiredCDPState, MarketParams, VaultInfo } from './internal/types';
import { ensureBigNumber } from './internal/utils';
import { calculateParamsIncreaseMP, calculateParamsDecreaseMP } from './internal/increaseDecreaseMP'

const  getMultiplyParams = function(
   
    marketParams: MarketParams,
    vaultInfo:VaultInfo,
    desiredCdp:DesiredCDPState,
    skipFlashLoan: boolean = false,
    debug : boolean = false,
  ): {
        debtDelta: BigNumber,
        collateralDelta: BigNumber,
        loanFee: BigNumber,
        oazoFee: BigNumber,
  }{
        let debtDelta = new BigNumber(0);
        let collateralDelta =  new BigNumber(0);
        let loanFee =  new BigNumber(0);
        let oazoFee =  new BigNumber(0);

        if(desiredCdp.withdrawColl.gt(0) || desiredCdp.withdrawDai.gt(0)){

            console.log("desiredCdp.withdrawColl.gt(0)");
              //decrease multiply
              [debtDelta,collateralDelta, oazoFee, loanFee] = calculateParamsDecreaseMP(
                  marketParams.oraclePrice,
                  marketParams.marketPrice,
                  marketParams.OF,
                  skipFlashLoan==false?marketParams.FF:new BigNumber(0),
                  vaultInfo.currentCollateral.minus(desiredCdp.withdrawColl),
                  vaultInfo.currentDebt.plus(desiredCdp.withdrawDai),
                  desiredCdp.requiredCollRatio,
                  marketParams.slippage,
                  desiredCdp.providedDai,
                  debug
              )
              debtDelta = debtDelta.times(-1);
              collateralDelta = collateralDelta.times(-1);
        }else{
            if(desiredCdp.providedDai.gt(0) || desiredCdp.providedCollateral.gt(0)){
                  console.log("desiredCdp.providedDai.gt(0)");
                  //increase multiply
                  [debtDelta,collateralDelta, oazoFee, loanFee] = calculateParamsIncreaseMP(
                        marketParams.oraclePrice,
                        marketParams.marketPrice,
                        marketParams.OF,
                        skipFlashLoan==false?marketParams.FF:new BigNumber(0),
                        vaultInfo.currentCollateral.plus(desiredCdp.providedCollateral),
                        vaultInfo.currentDebt.minus(desiredCdp.providedDai),
                        desiredCdp.requiredCollRatio,
                        marketParams.slippage,
                        desiredCdp.providedDai,
                        debug
                  )
            }else{
                  let currentCollRat = vaultInfo.currentCollateral.times(marketParams.oraclePrice).dividedBy(vaultInfo.currentDebt);
                  if(currentCollRat.lt(desiredCdp.requiredCollRatio)){
                        console.log("currentCollRat.lt(desiredCdp.requiredCollRatio)");
                        //decrease mult
                        [debtDelta,collateralDelta, oazoFee, loanFee] = calculateParamsDecreaseMP(
                              marketParams.oraclePrice,
                              marketParams.marketPrice,
                              marketParams.OF,
                              skipFlashLoan==false?marketParams.FF:new BigNumber(0),
                              vaultInfo.currentCollateral.minus(desiredCdp.withdrawColl),
                              vaultInfo.currentDebt.plus(desiredCdp.withdrawDai),
                              desiredCdp.requiredCollRatio,
                              marketParams.slippage,
                              desiredCdp.providedDai,
                              debug
                        )
                        debtDelta = debtDelta.times(-1);
                        collateralDelta = collateralDelta.times(-1);
                  }else{
                        console.log("currentCollRat.lt(desiredCdp.requiredCollRatio) == false",marketParams.FF.toFixed(3));
                        //increase mult
                        [debtDelta,collateralDelta, oazoFee, loanFee] = calculateParamsIncreaseMP(
                              marketParams.oraclePrice,
                              marketParams.marketPrice,
                              marketParams.OF,
                              skipFlashLoan==false?marketParams.FF:new BigNumber(0),
                              vaultInfo.currentCollateral.plus(desiredCdp.providedCollateral),
                              vaultInfo.currentDebt.minus(desiredCdp.providedDai),
                              desiredCdp.requiredCollRatio,
                              marketParams.slippage,
                              desiredCdp.providedDai,
                              debug
                        )
                  }
            }
        }

        return {
              debtDelta:ensureBigNumber(debtDelta),
              collateralDelta:ensureBigNumber(collateralDelta),
              loanFee:ensureBigNumber(loanFee),
              oazoFee:ensureBigNumber(oazoFee)
        }
  }

export { getMultiplyParams,  DesiredCDPState, MarketParams, VaultInfo}