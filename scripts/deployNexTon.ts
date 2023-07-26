import { toNano, Address } from 'ton-core';
import { NexTon } from '../wrappers/NexTon';
import { NetworkProvider } from '@ton-community/blueprint';
import { randomAddress } from '@ton-community/test-utils';

let myAddress: Address = Address.parse("kQAXUIBw-EDVtnCxd65Z2M21KTDr07RoBL6BYf-TBCd6dTBu");
let nftCollection: Address = Address.parse("EQDpNEt9Z3MVJJfxElU0m1AmrbtHJqrO4hZFSGle5pSyAgG3");

export async function run(provider: NetworkProvider) {
    const nexton = provider.open(await NexTon.fromInit(myAddress, nftCollection));

    await nexton.send(
        provider.sender(),
        {
            value: toNano('0.1'),
            bounce: false
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    
    await provider.waitForDeploy(nexton.address);

    // run methods on `invicore`
    await nexton.send(
        provider.sender(),
        {
            value: toNano('0.1'),
            bounce: false
        },
        null
    );

}