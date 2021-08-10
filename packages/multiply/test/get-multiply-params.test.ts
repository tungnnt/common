import { expect} from 'chai'; 
require("mocha");
import  * as _chai from 'chai'; 
import { BigNumber } from 'bignumber.js';
import {getMultiplyParams} from './../src/index'
import { DesiredCDPState, MarketParams, VaultInfo } from '../src/internal/types';
_chai.should();
let one = new BigNumber(1);
describe("getMultiplyParams no fees, slippage, zero price divergence/",async ()=>{

  let oraclePrice : BigNumber;
  let marketPrice : BigNumber;
  let OF : BigNumber;
  let FF : BigNumber;
  let marketParams : MarketParams;
  let vaultInfo : VaultInfo;
  
  
  before(async ()=>{
    marketParams = new MarketParams(3000,3000,0,0.0,0);
    vaultInfo = new VaultInfo(10000,10);
  });

  it("should be exported from package", async () =>{
    getMultiplyParams.should.be.not.undefined;
  })
  it("should return object", async ()=>{
    let val = getMultiplyParams(
        new MarketParams(0,0,0,0,0),
        new VaultInfo(0,0),
        new DesiredCDPState(0,0,0,0,0)
    )
    expect(val).to.not.be.undefined;
  })
  describe(`multiply increase inital debt=10000 collRatio 3`, async () => {
    it("should draw additional 10000 debt when changing collateralisation ratio from 3 to 2",async ()=>{
      let desiredCdpState = new DesiredCDPState(2,0,0,0,0);
      let retVal = getMultiplyParams(marketParams, vaultInfo, desiredCdpState, false);
      let finalDebt = retVal.debtDelta.plus(vaultInfo.currentDebt);
      let finalCollVal = retVal.collateralDelta.plus(vaultInfo.currentCollateral).times(marketParams.oraclePrice);
      expect(retVal.debtDelta.toNumber()).to.be.equal(10000);
      expect(retVal.collateralDelta.toNumber()).to.be.greaterThan(3.3333);
      expect(retVal.collateralDelta.toNumber()).to.be.lessThan(3.3334);
      expect(finalCollVal.dividedBy(finalDebt).toNumber()).to.be.greaterThan(1.9999);
      expect(finalCollVal.dividedBy(finalDebt).toNumber()).to.be.lessThan(2.0001);
    })
    it("should end with correct collateralisation ratio when changing collateralisation ratio from 3 to 2 and providing 10000 dai",async ()=>{
      let desiredCdpState = new DesiredCDPState(2,0,10000,0,0);
      let retVal = getMultiplyParams(marketParams, vaultInfo, desiredCdpState, false);
      let finalDebt = retVal.debtDelta.plus(vaultInfo.currentDebt);
      let finalCollVal = retVal.collateralDelta.plus(vaultInfo.currentCollateral).times(marketParams.oraclePrice);
      expect(finalCollVal.dividedBy(finalDebt).toNumber()).to.be.greaterThan(1.9999);
      expect(finalCollVal.dividedBy(finalDebt).toNumber()).to.be.lessThan(2.0001);
    })

  });
  describe(`multiply decrease inital debt=10000 collRatio 3`, async () => {
    it("should have collateral delta worth of 20000 DAI when withdrawing 5000 DAI and changing collateralisation ratio to 4", async ()=>{
      let desiredCdpState = new DesiredCDPState(4,0,0,5000,0);
      let retVal = getMultiplyParams(marketParams, vaultInfo, desiredCdpState, false);
      let finalCollVal = retVal.collateralDelta.plus(vaultInfo.currentCollateral).times(marketParams.oraclePrice);
      expect(finalCollVal.toNumber()).to.be.equal(20000);
    });
    it("should have debt delta equal 7500 DAI when withdrawing 10000 DAI worth of collateral and changing collateralisation ratio to 5", async ()=>{
      let desiredCdpState = new DesiredCDPState(5,0,0,0,one.times(10000).dividedBy(marketParams.marketPrice));
      let retVal = getMultiplyParams(marketParams, vaultInfo, desiredCdpState, false);
      let finalDebtVal = (vaultInfo.currentDebt).plus(retVal.debtDelta);
      expect(finalDebtVal.toNumber()).to.be.equal(2500);
    })
  });
});