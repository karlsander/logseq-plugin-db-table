import "@logseq/libs";
//import "ag-grid-enterprise";
import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { logseq as PL } from "../package.json";
import { BlockEntity } from "@logseq/libs/dist/LSPlugin";

const css = (t, ...args) => String.raw(t, ...args);

const pluginId = PL.id;

function main() {
  console.info(`#${pluginId}: MAIN`);

  const root = ReactDOM.createRoot(document.getElementById("app")!);

  root.render(<App />);

  function createModel() {
    return {
      show() {
        logseq.showMainUI();
      },
    };
  }
  /*
  logseq.Editor.registerSlashCommand("DB Table", async () => {
    await logseq.Editor.insertAtEditingCursor(`{{renderer :db-table}}}`);
  });

  logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
    console.log("onMacroRendererSlotted", slot, payload);
    if (payload.arguments[0] !== ":db-table") {
      return;
    }
    const uuid = payload.uuid;

    const rendererBlock = await logseq.Editor.getBlock(uuid, {
      includeChildren: true,
    });

    const tableID = "asdlkfj";

    const template = `<div id="${tableID}" data-slot-id="${slot}" data-chart-id="${tableID}" data-block-uuid="${uuid}"><h1>hey</h1></div>`;

    logseq.provideUI({
      key: `${tableID}`,
      slot,
      reset: true,
      template,
    });
    setTimeout(() => {
      logseq.App.queryElementById(slot).then((...e) =>
        console.log("element", e)
      );
      //const element = document.getElementById(tableID)!;
      //console.log(element);
      //const root = ReactDOM.createRoot(element);

      //root.render(<App />);
    }, 5000);
  });*/

  logseq.provideModel(createModel());
  logseq.setMainUIInlineStyle({
    zIndex: 11,
  });

  const openIconName = "template-plugin-open";

  logseq.provideStyle(css`
    .${openIconName} {
      opacity: 0.55;
      font-size: 20px;
      margin-top: 4px;
    }

    .${openIconName}:hover {
      opacity: 0.9;
    }
  `);

  logseq.App.registerUIItem("toolbar", {
    key: openIconName,
    template: `
      <div data-on-click="show" class="${openIconName}">⚙️</div>
    `,
  });
}

logseq.ready(main).catch(console.error);
