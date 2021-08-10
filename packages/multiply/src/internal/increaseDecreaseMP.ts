
import { BigNumber } from 'bignumber.js';

const one = new BigNumber(1);
const calculateParamsIncreaseMP = function (
    oraclePrice : BigNumber,
    marketPrice : BigNumber,
    OF : BigNumber,
    FF : BigNumber,
    currentColl : BigNumber,
    currentDebt : BigNumber,
    requiredCollRatio : BigNumber,
    slippage : BigNumber,
    depositDai = new BigNumber(0),
    debug = false,
  ) {
    if (debug) {
      console.log('calculateParamsIncreaseMP.oraclePrice', oraclePrice.toFixed(2))
      console.log('calculateParamsIncreaseMP.marketPrice', marketPrice.toFixed(2))
      console.log('calculateParamsIncreaseMP.OF', OF.toFixed(5))
      console.log('calculateParamsIncreaseMP.FF', FF.toFixed(5))
      console.log('calculateParamsIncreaseMP.currentColl', currentColl.toFixed(2))
      console.log('calculateParamsIncreaseMP.currentDebt', currentDebt.toFixed(2))
      console.log('calculateParamsIncreaseMP.requiredCollRatio', requiredCollRatio.toFixed(2))
      console.log('calculateParamsIncreaseMP.slippage', slippage.toFixed(2))
    }
    const marketPriceSlippage = marketPrice.times(one.plus(slippage))
    const debt = marketPriceSlippage
      .times(currentColl.times(oraclePrice).minus(requiredCollRatio.times(currentDebt)))
      .plus(oraclePrice.times(depositDai).minus(oraclePrice.times(depositDai).times(OF)))
      .div(
        marketPriceSlippage
          .times(requiredCollRatio)
          .times(one.plus(FF))
          .minus(oraclePrice.times(one.minus(OF))),
      )

    let ourFee = oraclePrice.times(depositDai).times(OF).plus(debt.times(one.plus(FF)).times(OF)); 
    let flashLoanFee = debt.times(FF);
    const collateral = debt.times(one.minus(OF)).div(marketPriceSlippage)
    if (debug) {
      console.log('Computed: calculateParamsIncreaseMP.debt', debt.toFixed(2))
      console.log('Computed: calculateParamsIncreaseMP.collateral', collateral.toFixed(2))
    }
    return [debt, collateral, ourFee, flashLoanFee]
  }


  const calculateParamsDecreaseMP = function (
    oraclePrice : BigNumber,
    marketPrice : BigNumber,
    OF : BigNumber,
    FF : BigNumber,
    currentColl : BigNumber,
    currentDebt : BigNumber,
    requiredCollRatio : BigNumber,
    slippage : BigNumber,
    depositDai = new BigNumber(0),
    debug = false,
  ) {
    if (debug) {
      console.log('calculateParamsDecreaseMP.oraclePrice', oraclePrice.toFixed(2))
      console.log('calculateParamsDecreaseMP.marketPrice', marketPrice.toFixed(2))
      console.log('calculateParamsDecreaseMP.OF', OF.toFixed(5))
      console.log('calculateParamsDecreaseMP.FF', FF.toFixed(5))
      console.log('calculateParamsDecreaseMP.currentColl', currentColl.toFixed(2))
      console.log('calculateParamsDecreaseMP.currentDebt', currentDebt.toFixed(2))
      console.log('calculateParamsDecreaseMP.requiredCollRatio', requiredCollRatio.toFixed(2))
      console.log('calculateParamsDecreaseMP.slippage', slippage.toFixed(2))
    }
    const marketPriceSlippage = marketPrice.times(one.minus(slippage))
    const debt = currentColl
      .times(oraclePrice)
      .times(marketPriceSlippage)
      .minus(requiredCollRatio.times(currentDebt).times(marketPriceSlippage))
      .div(
        oraclePrice
          .times(one.plus(FF).plus(OF).plus(OF.times(FF)))
          .minus(marketPriceSlippage.times(requiredCollRatio)),
      )
    const collateral = debt.times(one.plus(OF).plus(FF)).div(marketPriceSlippage)
    let ourFee = oraclePrice.times(depositDai).times(OF).plus(debt.times(one.plus(FF)).times(OF)); 
    let flashLoanFee = debt.times(FF);
    if (debug) {
      console.log('Computed: calculateParamsDecreaseMP.debt', debt.toFixed(2))
      console.log('Computed: calculateParamsDecreaseMP.collateral', collateral.toFixed(2))
    }
    return [debt, collateral, ourFee, flashLoanFee]
  }
  
export { calculateParamsIncreaseMP, calculateParamsDecreaseMP }