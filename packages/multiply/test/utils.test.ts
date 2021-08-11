import { expect} from 'chai'; 
require("mocha");
import  * as _chai from 'chai'; 
import { BigNumber } from 'bignumber.js';
import {ensureBigNumber} from './../src/internal/utils'
_chai.should();
let one = new BigNumber(1);
describe("utils.ensureBigNumber",async ()=>{
    it("should return BigNumber if provided with number", function(){
        let retVal = ensureBigNumber(4);
        expect(retVal.toNumber()).to.be.equal(4);
    })
    it("should return BigNumber if provided with string", function(){
        let retVal = ensureBigNumber("4");
        expect(retVal.toNumber()).to.be.equal(4);
    })
    it("should return BigNumber if provided with BigNumber", function(){
        let retVal = ensureBigNumber(new BigNumber(4));
        expect(retVal.toNumber()).to.be.equal(4);
    })
    it("should throw provided with garbage", function(){
        let ex : any = undefined;
        try{
            let retVal = ensureBigNumber({x:3});
            console.log(retVal);
        }catch(e){
            ex = e;
        }
        expect(ex).to.be.not.undefined;
    })

});