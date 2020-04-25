<script>
  export let IPFS;
  import OrbitDB from 'orbit-db';

  const creatures = [
    "🐙",
    "🐷",
    "🐬",
    "🐞",
    "🐈",
    "🙉",
    "🐸",
    "🐓",
    "🐊",
    "🕷",
    "🐠",
    "🐘",
    "🐼",
    "🐰",
    "🐶",
    "🐥"
  ];

  export let outputHeaderElm = ""; //= document.getElementById("output-header")
  export let outputElm = ""; //= document.getElementById("output")
  export let statusElm = "Init..."; // = document.getElementById("status")
  export let dbnameField; //= document.getElementById("dbname")
  export let dbAddressField; //= document.getElementById("dbaddress")
  export let disabled = true; // = document.getElementById("create")
  export let createType; //= document.getElementById("type")
  export let writerText = ""; //= document.getElementById("writerText")
  export let publicCheckbox; //= document.getElementById("public")
  export let readonlyCheckbox; // = document.getElementById("readonly")

  function handleError(e) {
    console.error(e.stack);
    statusElm = e.message;
  }

  let orbitdb, db;
  let count = 0;
  let interval = Math.floor(Math.random() * 300 + Math.random() * 2000);
  let updateInterval;
  let dbType, dbAddress;

  var options = {
    repo: "/orbitdb/examples/browser/new/ipfs/0.43.0"
  };

  async function createDatabase() {
    await resetDatabase(db);

    disabled = true;

    try {
      const name = dbnameField;
      const type = createType;
      const publicAccess = publicCheckbox;

      db = await orbitdb.open(name, {
        // If database doesn't exist, create it
        create: true,
        overwrite: true,
        // Load only the local version of the database,
        // don't load the latest from the network yet
        localOnly: false,
        type: type,
        // If "Public" flag is set, allow anyone to write to the database,
        // otherwise only the creator of the database can write
        accessController: {
          write: publicAccess ? ["*"] : [orbitdb.identity.id]
        }
      });

      await load(db, "Creating database...");
      startWriter(db, interval);
    } catch (e) {
      console.error(e);
    }
    disabled = false;
  }

  async function openDatabase() {
    const address = dbAddressField;

    await resetDatabase(db);

    disabled = true;

    try {
      statusElm = "Connecting to peers...";
      db = await orbitdb.open(address, { sync: true });
      await load(db, "Loading database...");

      if (!readonlyCheckbox) {
        startWriter(db, interval);
      } else {
        writerText = `Listening for updates to the database...`;
      }
    } catch (e) {
      console.error(e);
    }
    disabled = false;
  }

  // Create IPFS instance
  IPFS.create(options).then(async(ipfs) => {

    disabled = false;
    statusElm = "IPFS Started";
    orbitdb = await OrbitDB.createInstance(ipfs);
    
    const load = async (db, statusText) => {
      // Set the status text
      statusElm = statusText;

      // When the database is ready (ie. loaded), display results
      db.events.on("ready", () => queryAndRender(db));
      // When database gets replicated with a peer, display results
      db.events.on("replicated", () => queryAndRender(db));
      // When we update the database, display result
      db.events.on("write", () => queryAndRender(db));

      db.events.on("replicate.progress", () => queryAndRender(db));

      // Hook up to the load progress event and render the progress
      let maxTotal = 0,
        loaded = 0;
      db.events.on("load.progress", (address, hash, entry, progress, total) => {
        loaded++;
        maxTotal = Math.max.apply(null, [maxTotal, progress, 0]);
        total = Math.max.apply(null, [
          progress,
          maxTotal,
          total,
          entry.clock.time,
          0
        ]);
        statusElm = `Loading database... ${maxTotal} / ${total}`;
      });

      db.events.on("ready", () => {
        // Set the status text
        setTimeout(() => {
          statusElm = "Database is ready";
        }, 1000);
      });

      // Load locally persisted database
      await db.load();
    };

    const startWriter = async (db, interval) => {
      // Set the status text
      writerText = `Writing to database every ${interval} milliseconds...`;

      // Start update/insert loop
      updateInterval = setInterval(async () => {
        try {
          await update(db);
        } catch (e) {
          console.error(e.toString());
          writerText = '<span style="color: red">' + e.toString() + "</span>";
          clearInterval(updateInterval);
        }
      }, interval);
    };

    const resetDatabase = async db => {
      writerText = "";
      outputElm = "";
      outputHeaderElm = "";

      clearInterval(updateInterval);

      if (db) {
        await db.close();
      }

      interval = Math.floor(Math.random() * 300 + Math.random() * 2000);
    };

    const update = async db => {
      count++;

      const time = new Date().toISOString();
      const idx = Math.floor(Math.random() * creatures.length);
      const creature = creatures[idx];

      if (db.type === "eventlog") {
        const value =
          "GrEEtinGs from " +
          orbitdb.id +
          " " +
          creature +
          ": Hello #" +
          count +
          " (" +
          time +
          ")";
        await db.add(value);
      } else if (db.type === "feed") {
        const value =
          "GrEEtinGs from " +
          orbitdb.id +
          " " +
          creature +
          ": Hello #" +
          count +
          " (" +
          time +
          ")";
        await db.add(value);
      } else if (db.type === "docstore") {
        const value = { _id: "peer1", avatar: creature, updated: time };
        await db.put(value);
      } else if (db.type === "keyvalue") {
        await db.set("mykey", creature);
      } else if (db.type === "counter") {
        await db.inc(1);
      } else {
        throw new Error("Unknown datatbase type: ", db.type);
      }
    };

    const query = db => {
      if (db.type === "eventlog") return db.iterator({ limit: 5 }).collect();
      else if (db.type === "feed") return db.iterator({ limit: 5 }).collect();
      else if (db.type === "docstore") return db.get("peer1");
      else if (db.type === "keyvalue") return db.get("mykey");
      else if (db.type === "counter") return db.value;
      else throw new Error("Unknown datatbase type: ", db.type);
    };

    const queryAndRender = async db => {
      const networkPeers = await ipfs.swarm.peers();
      const databasePeers = await ipfs.pubsub.peers(db.address.toString());

      const result = query(db);

      if (dbType !== db.type || dbAddress !== db.address) {
        dbType = db.type;
        dbAddress = db.address;

        outputHeaderElm = `
        <h2>${dbType.toUpperCase()}</h2>
        <h3 id="remoteAddress">${dbAddress}</h3>
        <p>Copy this address and use the 'Open Remote Database' in another browser to replicate this database between peers.</p>
      `;
      }

      outputElm = `
      <div><b>Peer ID:</b> ${orbitdb.id}</div>
      <div><b>Peers (database/network):</b> ${databasePeers.length} / ${
        networkPeers.length
      }</div>
      <div><b>Oplog Size:</b> ${Math.max(
        db._replicationStatus.progress,
        db._oplog.length
      )} / ${db._replicationStatus.max}</div>
      <h2>Results</h2>
      <div id="results">
        <div>
        ${
          result &&
          Array.isArray(result) &&
          result.length > 0 &&
          db.type !== "docstore" &&
          db.type !== "keyvalue"
            ? result
                .slice()
                .reverse()
                .map(e => e.payload.value)
                .join("<br>\n")
            : db.type === "docstore"
            ? JSON.stringify(result, null, 2)
            : result
            ? result
                .toString()
                .replace('"', "")
                .replace('"', "")
            : result
        }
        </div>
      </div>
    `;
    };
  });
</script>

<style>
  #logo {
    border-top: 1px dotted black;
    border-bottom: 1px dotted black;
  }

  #status {
    border-top: 1px dotted black;
    border-bottom: 1px dotted black;
    padding: 0.5em 0em;
    text-align: center;
  }

  #results {
    border: 1px dotted black;
    padding: 0.5em;
  }

  #writerText {
    padding-top: 0.5em;
  }

  pre {
    text-align: center;
  }

  input {
    padding: 0.5em;
  }

  h2 {
    margin-bottom: 0.2em;
  }
  h3 {
    margin-top: 0.8em;
    margin-bottom: 0.2em;
  }

  .github-corner:hover .octo-arm {
    animation: octocat-wave 560ms ease-in-out;
  }
  @keyframes octocat-wave {
    0%,
    100% {
      transform: rotate(0);
    }
    20%,
    60% {
      transform: rotate(-25deg);
    }
    40%,
    80% {
      transform: rotate(10deg);
    }
  }
  @media (max-width: 500px) {
    .github-corner:hover .octo-arm {
      animation: none;
    }
    .github-corner .octo-arm {
      animation: octocat-wave 560ms ease-in-out;
    }
  }
</style>

<a
  href="https://github.com/orbitdb/orbit-db"
  class="github-corner"
  aria-label="View source on Github">
  <svg
    width="80"
    height="80"
    viewBox="0 0 250 250"
    style="fill:#151513; color:#fff; position: absolute; top: 0; border: 0;
    right: 0;"
    aria-hidden="true">
    <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
    <path
      d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6
      120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3
      125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
      fill="currentColor"
      style="transform-origin: 130px 106px;"
      class="octo-arm" />
    <path
      d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6
      C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0
      C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1
      C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4
      C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9
      C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5
      C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9
      L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
      fill="currentColor"
      class="octo-body" />
  </svg>
</a>

<div id="logo">
  <pre>
                   _     _ _         _ _     
                | |   (_) |       | | |    
       ___  _ __| |__  _| |_    __| | |__  
      / _ \| '__| '_ \| | __|  / _\` | '_\ 
     | (_) | |  | |_) | | |_  | (_| | |_) |
      \___/|_|  |_.__/|_|\__|  \__,_|_.__/ 
    Peer-to-Peer Database for the Decentralized Web
    <a href="https://github.com/orbitdb/orbit-db" target="_blank">
      https://github.com/orbitdb/orbit-db
    </a>
  </pre>
</div>
<h2>Open or Create Local Database</h2>
<i>Open a database locally and create it if the database doesn't exist.</i>
<br />
<br />
<input
  id="dbname"
  bind:value={dbnameField}
  type="text"
  placeholder="Database name" />
<button id="create" type="button" {disabled} on:click={createDatabase}>
  Open
</button>
<select id="type" bind:value={createType}>
  <option value="eventlog">Eventlog</option>
  <option value="feed">Feed</option>
  <option value="keyvalue">Key-Value</option>
  <option value="docstore">DocumentDB</option>
  <option value="counter">Counter</option>
</select>
<input id="public" type="checkbox" bind:checked={publicCheckbox} />
Public
<h2>Open Remote Database</h2>
<i>
  Open a database from an OrbitDB address, eg.
  /orbitdb/QmfY3udPcWUD5NREjrUV351Cia7q4DXNcfyRLJzUPL3wPD/hello
</i>
<br />
<i>
  <b>Note!</b>
  Open the remote database in an Incognito Window or in a different browser. It
  won't work if you don't.
</i>
<br />
<br />
<input
  id="dbaddress"
  type="text"
  placeholder="Address"
  bind:value={dbAddressField} />
<button id="open" type="button" {disabled} on:click={openDatabase}>Open</button>
<input id="readonly" type="checkbox" bind:checked={readonlyCheckbox} />
Read-only
<br />
<br />
<div id="status">{statusElm}</div>
<div>
  <header id="output-header" />{outputHeaderElm}
  <div id="output" />
  {outputElm}
</div>
<div id="writerText" />{writerText}
