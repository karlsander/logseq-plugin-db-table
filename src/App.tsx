import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useAppVisible } from "./utils";
import { AgGridReact } from "ag-grid-react";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const query = `[:find (pull ?h [*])
            :where
            [?h :block/marker ?marker]
            [(contains? #{"NOW" "DOING"} ?marker)]]`;

function Table({ columnDefs, rowData }: { columnDefs: any; rowData: any }) {
  const gridRef = useRef();

  const cellClickedListener = useCallback((event) => {
    console.log("cellClicked", event);
  }, []);

  const detailCellRenderer = useCallback(({ data, ...rest }) => {
    console.log(data.block);
    return (
      <div style={{ margin: 8 }}>
        {data.block.content.split("\n").map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    );
  }, []);

  return (
    <div
      className="ag-theme-alpine-dark"
      style={{ width: "100vw", height: "85vh" }}
    >
      <AgGridReact
        //@ts-ignore
        ref={gridRef}
        rowData={rowData}
        rowGroupPanelShow={"always"}
        pivotPanelShow={"always"}
        sideBar={{
          toolPanels: ["columns", "filters"],
        }}
        defaultColDef={{
          resizable: true,
          sortable: true,
          filter: true,
          pivot: true,
          enableRowGroup: true,
          enablePivot: true,
          enableValue: true,
        }}
        columnDefs={columnDefs}
        onCellClicked={cellClickedListener}
        enableRangeSelection={true}
        masterDetail={true}
        detailCellRenderer={detailCellRenderer}
        statusBar={{
          statusPanels: [
            {
              statusPanel: "agTotalAndFilteredRowCountComponent",
              align: "left",
            },
            { statusPanel: "agTotalRowCountComponent", align: "center" },
            { statusPanel: "agFilteredRowCountComponent" },
            { statusPanel: "agSelectedRowCountComponent" },
            { statusPanel: "agAggregationComponent" },
          ],
        }}
      />
    </div>
  );
}

function DelayedTable() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(true);
  }, []);

  const [data, setData] = useState([] as any[]);
  const [types, setTypes] = useState([] as any[]);
  const [activeType, setActiveType] = useState(null);

  useEffect(() => {
    async function execute() {
      try {
        const res = await logseq.DB.q("(property is)");
        const data = res!.map(({ properties, ...rest }) => ({
          blockTitle:
            properties.title ||
            properties.name ||
            properties.label ||
            rest.content.split("\n")[0],
          ...properties,
          block: rest,
          content: rest.content,
        }));
        const types = new Set();
        data.forEach((d) => {
          d.is.forEach((t) => types.add(t));
        });
        setTypes([...types]);
        setActiveType([...types][0]);
        setData(data);
      } catch (e) {
        console.error(e);
      }
    }
    execute();
  }, []);

  const [rowData, columnDefs] = useMemo(() => {
    const rows = data.filter(({ is }) => is.includes(activeType));
    const columnKeys = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => columnKeys.add(k)));
    columnKeys.delete("block");
    const columnDefs = [...columnKeys].map((k) => ({
      field: k,
      hide: ["is", "title", "content"].includes(k),
    }));
    if (columnDefs.length >= 1) {
      columnDefs[0].cellRenderer = "agGroupCellRenderer";
    }
    return [rows, columnDefs];
  }, [data, activeType]);

  if (show) {
    return (
      <div>
        <div>
          {types.map((t) => (
            <button
              style={{ margin: 8, color: "white" }}
              key={t}
              onClick={() => setActiveType(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <Table columnDefs={columnDefs} rowData={rowData} />
      </div>
    );
  } else {
    return null;
  }
}

function App() {
  const innerRef = useRef<HTMLDivElement>(null);
  const visible = useAppVisible();

  if (visible) {
    return (
      <main
        className="backdrop-filter backdrop-blur-md fixed inset-0 flex items-center justify-center"
        onClick={(e) => {
          if (!innerRef.current?.contains(e.target as any)) {
            window.logseq.hideMainUI();
          }
        }}
      >
        <div ref={innerRef}>
          <DelayedTable />
        </div>
      </main>
    );
  }
  return null;
}

export default App;
