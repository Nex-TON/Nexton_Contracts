import { toNano, Address } from 'ton-core';
import { NexTon } from '../wrappers/NexTon';
import { NetworkProvider } from '@ton-community/blueprint';
import { randomAddress } from '@ton-community/test-utils';

const myAddress: Address = Address.parse("kQAXUIBw-EDVtnCxd65Z2M21KTDr07RoBL6BYf-TBCd6dTBu");
const nftCollection: Address = Address.parse("EQCB47QNaFJ_Rok3GpoPjf98cKuYY1kQwgqeqdOyYJFrywUK");

export async function run(provider: NetworkProvider) {
    const nexton = provider.open(await NexTon.fromAddress(Address.parse("EQBbLEh35tVinABuY2k10g5Adep0mvQw1lXNvLkchC5_njOW")));
        //fromInit(myAddress, nftCollection));
    const ui = provider.ui();

    const command =  await ui.input('Continue?');

    //const maxLeverage = await nexton.getMaxLeverage;

    await nexton.send(
        provider.sender(),
        {
            value: toNano('0.1'),
        },
        {
            $$type: 'UserClaimWithdraw',
            itemIndex: 0n
        }
    );

    console.log("Withdrawn!");

}
