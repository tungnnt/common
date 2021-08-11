import { expect } from 'chai';
require('mocha');
import * as _chai from 'chai';
import { BigNumber } from 'bignumber.js';
import { getMultiplyParams } from './../src/index';
import { DesiredCDPState, MarketParams, VaultInfo } from '../src/internal/types';
_chai.should();
describe('getMultiplyParams no oazo fee, slippage, zero price divergence, FF applied - 50%', async () => {
  let marketParams: MarketParams;
  let vaultInfo: VaultInfo;

  before(async () => {
    marketParams = new MarketParams(3000, 3000, 0.5, 0.0, 0);
    vaultInfo = new VaultInfo(10000, 10);
  });

  describe(`multiply increase inital debt=10000 collRatio 3`, async () => {
    it('should pay FF of 2500 when changing collRatio from 3 to 2', async () => {
      const desiredCdpState = new DesiredCDPState(new BigNumber(2), 0, 0, 0, 0);
      const retVal = getMultiplyParams(marketParams, vaultInfo, desiredCdpState, false, false);
      const finalDebt = retVal.debtDelta
        .plus(vaultInfo.currentDebt)
        .plus(retVal.oazoFee)
        .plus(retVal.loanFee);
      const finalCollVal = retVal.collateralDelta
        .plus(vaultInfo.currentCollateral)
        .times(marketParams.oraclePrice);
      console.log('coll and debt USD value', finalCollVal.toFixed(5), finalDebt.toFixed(5));
      expect(retVal.oazoFee.toNumber()).to.be.equal(0);
      expect(retVal.loanFee.toNumber()).to.be.equal(2500);
    });
  });

  describe(`multiply decrease inital debt=10000 collRatio 3`, async () => {
    it('should have FF equal to 2500 when changing collateralisation ratio to 4', async () => {
      const desiredCdpState = new DesiredCDPState(5, 0, 0, 0, 0);
      const retVal = getMultiplyParams(marketParams, vaultInfo, desiredCdpState, false, false);
      const finalDebt = retVal.debtDelta.plus(vaultInfo.currentDebt);
      const finalCollVal = retVal.collateralDelta
        .plus(vaultInfo.currentCollateral)
        .times(marketParams.oraclePrice);
      console.log('coll and debt USD value', finalCollVal.toFixed(5), finalDebt.toFixed(5));
      console.log('oazoFee,loanFee', retVal.oazoFee.toNumber(), retVal.loanFee.toNumber());
      expect(retVal.oazoFee.toNumber()).to.be.equal(0);
      expect(retVal.loanFee.toNumber()).not.be.equal(2500);
    });
  });
});
