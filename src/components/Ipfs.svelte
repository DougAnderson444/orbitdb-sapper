<script>
  // svelte stuff
  import { onMount } from "svelte";

  //stores
  import {
    nodeId,
    nodeAgentVersion,
    nodeProtocolVersion,
    ipfsNode,
    rootHash
  } from "./stores.js";

  // IPFS
  import IPFS from "ipfs";

  let password = "";
  let modifier = "";
  let addedFileContents;

  onMount(async () => {
    // from ipfs browser-webpack
    // name the repository, repository saved in the browser's IndexedDB
    // https://github.com/ipfs/js-ipfs/tree/master/packages/ipfs#ipfs-constructor

    const options = {
      repo: "ipfs" + modifier, // default is "ipfs", string or ipfs.Repo instance, file path at which to store the IPFS node’s data, String(Math.random() + Date.now())
      pass: password // https://github.com/ipfs/js-ipfs/issues/1138
      //init: {				// only runs initially
      //privateKey: privKey, // (base64 PrivKey) string or full PeerId, A pre-generated private key to use. Can be either a base64 string or a PeerId instance.
      //}
    };

    /*
     * START IPFS NODE
     */
    $ipfsNode = await IPFS.create(options);
    console.log(`ipfs node ready \n ${$ipfsNode}`);
    const { id, agentVersion, protocolVersion } = await $ipfsNode.id();

    //copy to svelte stores
    $nodeId = id;
    $nodeAgentVersion = agentVersion;
    $nodeProtocolVersion = protocolVersion;

    for await (const { cid } of $ipfsNode.add("Saved some data to IPFS, cool!")) {
      $rootHash = cid.toString();

      //ipns --> Slow AF, unuseable
      //res = await $ipfsNode.name.publish( `/ipfs/${addedFileHash}`)
      //console.log(`IPNS pub ${res.value} to nodeId: https://gateway.ipfs.io/ipns/${res.name}`)

      let bufs = [];

      for await (const buf of $ipfsNode.cat(cid)) {
        bufs.push(buf);
      }

      const data = Buffer.concat(bufs);
      addedFileContents = data.toString("utf8");
    }
  });
</script>

<style>
  div.outer {
    outline: 1px solid lightgray;
    padding: 15px;
  }
</style>

<div class="outer">
  {#if $nodeId}
    <div>
      <h2>Your node is running in the browser.</h2>
      <p>
        <b>
          View your data in web 3.0'land (kinda like a blockchain, but
          different):
        </b>
        <br />
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://explore.ipld.io/#/explore/{$rootHash}">
          {$rootHash}
        </a>
      </p>
      <p>Browser nodeID: {$nodeId}</p>
      <p>{addedFileContents}</p>
    </div>
  {:else}
    <div>
      <h2>Loading your peer node...</h2>
    </div>
  {/if}
</div>
