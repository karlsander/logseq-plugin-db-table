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

function Table({
  columnDefs,
  rowData,
  pinnedRowRef,
  activeType,
  refetch,
}: {
  columnDefs: any;
  rowData: any;
  pinnedRowRef: any;
  activeType: string;
  refetch: () => void;
}) {
  const gridRef = useRef();

  const cellClickedListener = useCallback((event) => {
    console.log("cellClicked", event);
  }, []);

  const detailCellRenderer = useCallback(({ data, ...rest }) => {
    return (
      <div style={{ margin: 8 }}>
        {data.block.content.split("\n").map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    );
  }, []);

  const getContextMenuItems = useCallback(
    (params) => {
      const result = [
        {
          name: "!!!! Delete !!!!",
          action: () => {
            const isPage = Boolean(params.node.data.block["preBlock?"]);

            if (isPage) {
              logseq.Editor.deletePage(params.node.data.block.page.name);
            } else {
              const id = params.node.data.block.uuid;
              logseq.Editor.removeBlock(id);
            }
            logseq.Editor.exitEditingMode();
            refetch();
          },
        },
        "separator",
        "copy",
        "copyWithHeaders",
        "copyWithGroupHeaders",
        "export",
        //"chartRange",
      ];
      return result;
    },
    [refetch]
  );

  return (
    <div
      className={
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "ag-theme-alpine-dark"
          : "ag-theme-alpine"
      }
      style={{ width: "100vw", height: "calc(100vh - 72px)" }}
    >
      <AgGridReact
        //@ts-ignore
        getContextMenuItems={getContextMenuItems}
        ref={gridRef}
        rowData={rowData}
        rowGroupPanelShow={"always"}
        pivotPanelShow={"always"}
        sideBar={{
          toolPanels: ["columns", "filters"],
        }}
        pinnedTopRowData={[pinnedRowRef.current]}
        onPinnedRowDataChanged={(...args) => {
          console.log("pinnedRowDataChanged", args);
        }}
        onCellKeyPress={(e) => {
          if (e?.event?.keyCode === 13 && e?.rowPinned) {
            const { blockTitle, ...rest } = pinnedRowRef.current;
            const text =
              `${blockTitle}\n` +
              `is:: [[${activeType}]]\n` +
              Object.keys(rest)
                .map((k) => `${k}:: ${rest[k]}`)
                .join("\n");
            logseq.Editor.appendBlockInPage(activeType, text).then(() => {
              refetch();
              pinnedRowRef.current = {};
              gridRef?.current?.api?.setPinnedTopRowData([
                pinnedRowRef.current,
              ]);
              logseq.Editor.exitEditingMode();
            });
          }
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

function useQuery(dsl: string) {
  const [data, setData] = useState<any[]>();
  const refetch = useCallback(() => {
    logseq.DB.q(dsl).then((data) => {
      //@ts-ignore
      setData(data);
    });
  }, [dsl]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { data, refetch };
}

function DataTable({
  data,
  refetch,
  type,
}: {
  data: any[];
  refetch: () => void;
  type: string;
}) {
  const pinnedRowRef = useRef({});

  useEffect(() => {
    logseq.Editor.exitEditingMode();
  }, []);

  const rows = useMemo(() => {
    if (data) {
      return data
        .map(({ properties, ...rest }) => {
          if (!rest.content || !rest.uuid || !rest.page) {
            return null;
          }
          const isPage = Boolean(rest["preBlock?"]);
          return {
            ...properties,
            blockTitle:
              properties.label ||
              properties.name ||
              properties.title ||
              (isPage ? rest.page?.name : rest.content.split("\n")[0]),
            block: rest,
            content: rest.content,
            page: rest.page.name,
          };
        })
        .filter(Boolean);
    } else {
      return [];
    }
  }, [data]);

  const columnDefs = useMemo(() => {
    const hiddenFields = [
      "is",
      "title",
      "content",
      "alias",
      "icon",
      "page",
      "banner",
      "name",
      "label",
    ];
    const notEditable = ["blockTitle", "block", "page", "is", "content"];
    const columnKeys = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => columnKeys.add(k)));
    columnKeys.delete("block");
    const columnDefs = [...columnKeys].map((k) => {
      return {
        field: k,
        valueSetter: (params) => {
          if (!params.node.rowPinned) {
            logseq.Editor.upsertBlockProperty(
              params.data.block.uuid,
              k,
              params.newValue
            ).then(() => {
              logseq.Editor.exitEditingMode();
            });
            params.data[k] = params.newValue;
            return true;
          } else {
            pinnedRowRef.current[k] = params.newValue;
            return true;
          }
        },
        hide: hiddenFields.includes(k),
        cellRenderer: k === "blockTitle" ? "agGroupCellRenderer" : undefined,
        pinned: k === "blockTitle" ? "left" : undefined,
        width: k === "blockTitle" ? 300 : undefined,
        headerName: k === "blockTitle" ? "Block" : k,
        editable: (params) => {
          if (params.node.rowPinned) {
            return true;
          } else {
            return !notEditable.includes(k);
          }
        },
      };
    });

    return columnDefs;
  }, [rows]);
  return (
    <Table
      activeType={type}
      pinnedRowRef={pinnedRowRef}
      columnDefs={columnDefs}
      rowData={rows}
      refetch={refetch}
    />
  );
}

function DataPage({ type }: { type: string }) {
  const { data, refetch } = useQuery(`(property is "${type}")`);
  if (data) {
    return <DataTable data={data} refetch={refetch} type={type} />;
  } else {
    return null;
  }
}

function DelayedTable() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(true);
  }, []);

  const [activeType, setActiveType] = useState<string>();
  const { data } = useQuery(`(property is)`);
  const types = useMemo(() => {
    if (data) {
      const types = new Set<string>();
      data.forEach((d) => {
        if (d.properties.is.forEach) {
          d.properties.is.forEach((t) => types.add(t));
        } else if (d.properties.is) {
          types.add(d.properties.is);
        }
      });
      setActiveType([...types][0]);
      return [...types] as string[];
    } else {
      return [];
    }
  }, [data]);

  if (show && activeType) {
    return (
      <div>
        <div style={{ height: 72, background: "black" }}>
          <div
            onClick={() => window.logseq.hideMainUI()}
            style={{ width: "100%", height: 32 }}
          />
          <div style={{ marginLeft: 8 }}>
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
        </div>
        <DataPage type={activeType} />
      </div>
    );
  } else {
    return null;
  }
}

function App() {
  const visible = useAppVisible();

  if (visible) {
    return (
      <main className="fixed inset-0 flex items-center justify-center">
        <DelayedTable />
      </main>
    );
  }
  return null;
}

export default App;
