import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useAppVisible } from "./utils";
import { AgGridReact } from "ag-grid-react";
import { useThemeMode } from "./logseqHooks";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { initial } from "lodash";
import { Color } from "ag-grid-community";
import { ColDef } from "ag-grid-community/dist/lib/entities/colDef";

function closeAndOpenBlock(uuid) {
  logseq.hideMainUI();
  logseq.Editor.openInRightSidebar(uuid);
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

function useBlock(uuid: string) {
  const [data, setData] = useState<any[]>();
  const refetch = useCallback(() => {
    logseq.Editor.getBlock(uuid).then((data) => {
      //@ts-ignore
      setData(data);
    });
  }, [uuid]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  return { data, refetch };
}

function useParamsBlockUUID(pageName) {
  const [uuid, setUUID] = useState<string>();
  useEffect(() => {
    logseq.Editor.getPageBlocksTree(pageName).then((data) => {
      const paramBlock = data.find(({ left, page }) => left.id === page.id);
      if (paramBlock) {
        setUUID(paramBlock.uuid);
      } else {
        throw new Error("couldn't find block to store params");
      }
    });
  }, [pageName]);
  return uuid;
}

function usePageProperty(pageName: string, property: string, initial = "") {
  const [value, setValue] = useState<string>(initial);
  const blockID = useParamsBlockUUID(pageName);
  useEffect(() => {
    if (blockID) {
      logseq.Editor.getBlockProperty(blockID, property).then((propValue) => {
        if (propValue && typeof propValue === "string") {
          setValue(propValue);
        }
      });
    }
  }, [property, blockID, initial]);

  useEffect(() => {
    if (blockID) {
      return logseq.DB.onBlockChanged(blockID, (v) => {
        setValue(v.properties[property]);
      });
    }
  }, [blockID, property]);

  const setPropValue = useCallback(
    (newVal) => {
      if (blockID) {
        logseq.Editor.upsertBlockProperty(blockID, property, newVal).then(() =>
          logseq.Editor.exitEditingMode()
        );
      }
    },
    [blockID, property]
  );
  return [value, setPropValue] as [typeof value, typeof setPropValue];
}

function usePageProperties(pageName: string) {
  const [value, setValue] = useState<any>();
  const blockID = useParamsBlockUUID(pageName);
  useEffect(() => {
    if (blockID) {
      logseq.Editor.getBlockProperties(blockID).then((properties) => {
        setValue({ ...properties });
      });
    }
  }, [blockID]);

  useEffect(() => {
    if (blockID) {
      return logseq.DB.onBlockChanged(blockID, (v) => {
        setValue({ ...v.properties });
      });
    }
  }, [blockID]);

  const setPropValue = useCallback(
    (key, newVal) => {
      if (blockID) {
        logseq.Editor.upsertBlockProperty(blockID, key, newVal).then(() =>
          logseq.Editor.exitEditingMode()
        );
      }
    },
    [blockID]
  );
  return [value, setPropValue] as [typeof value, typeof setPropValue];
}

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
  const themeMode = useThemeMode();

  return (
    <div
      className={
        themeMode === "dark" ? "ag-theme-alpine-dark" : "ag-theme-alpine"
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
          //@ts-ignore
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
              //@ts-ignore
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

const NumberCellRenderer = ({ value }) => {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          textAlign: "right",
          fontFamily: "monospace",
          fontWeight: "bold",
        }}
      >
        {value}
      </div>
    </div>
  );
};

const NumberCellEditor = forwardRef((props: { value: string }, ref) => {
  const [value, setValue] = useState(parseInt(props.value));
  const refInput = useRef(null);
  useEffect(() => {
    refInput.current.focus();
  }, []);
  useImperativeHandle(ref, () => {
    return {
      getValue: () => value,
      isCancelBeforeStart: () => false,
      isCancelAfterEnd: () => false,
    };
  });

  return (
    <input
      type="number"
      ref={refInput}
      value={value}
      onChange={(event) => setValue(Number(event.target.value))}
      style={{
        width: "100%",
        textAlign: "right",
        fontFamily: "monospace",
        fontWeight: "bold",
      }}
    />
  );
});

function parseBlock(block) {
  return {
    properties: block.properties,
    content: block.content,
    uuid: block.uuid,
    page: block.page?.name,
    blockTitle:
      block.properties?.label ||
      block.properties?.name ||
      block.properties?.title ||
      (block["preBlock?"] ? block.page?.name : block.content?.split("\n")[0]),
  };
}

const RefCellRenderer = ({ value }) => {
  const { data } = useBlock(
    value &&
      value.includes("((") &&
      value.includes("))") &&
      value.split("((")[1].split("))")[0]
  );
  if (data) {
    return <div>{parseBlock(data).blockTitle}</div>;
  } else {
    return null;
  }
};

const RefCellEditor = forwardRef(
  (props: { value: string; type: string }, ref) => {
    const [value, setValue] = useState(
      props.value &&
        props.value.includes("((") &&
        props.value.includes("))") &&
        props.value.split("((")[1].split("))")[0]
    );

    const refInput = useRef(null);
    const { data } = useQuery(`(property is "${props.type}")`);
    const options = data && data.map(parseBlock);

    useEffect(() => {
      refInput.current.focus();
    }, []);

    useImperativeHandle(ref, () => {
      return {
        getValue: () => {
          logseq.Editor.upsertBlockProperty(value, "id", value);
          return "((" + value + "))";
        },
        isCancelBeforeStart: () => false,
        isCancelAfterEnd: () => false,
      };
    });

    return (
      <select
        ref={refInput}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        style={{ marginLeft: 12, width: "calc(100% - 24px)" }}
      >
        {options &&
          options.map((o) => (
            <option key={o.uuid} value={o.uuid}>
              {o.blockTitle}
            </option>
          ))}
      </select>
    );
  }
);

const DateCellEditor = forwardRef((props: { value: string }, ref) => {
  const [value, setValue] = useState(
    props.value &&
      props.value.includes("[[") &&
      props.value.includes("]]") &&
      props.value.split("[[")[1].split("]]")[0]
  );
  const refInput = useRef(null);

  useEffect(() => {
    refInput.current.focus();
  }, []);

  useImperativeHandle(ref, () => {
    return {
      getValue: () => "[[" + value + "]]",
      isCancelBeforeStart: () => false,
      isCancelAfterEnd: () => false,
    };
  });

  return (
    <input
      type="date"
      ref={refInput}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      style={{ width: "100%" }}
    />
  );
});

const DateCellRenderer = ({ value }) => {
  return <div>{value}</div>;
};

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

  const [pageProperties, setPageProperty] = usePageProperties(type);

  const fieldProperties = useMemo(
    () =>
      pageProperties
        ? Object.fromEntries(
            Object.entries(pageProperties)
              .filter(([key]) => key.startsWith("field."))
              .map(([key, value]) => [key.replace("field.", ""), value])
          )
        : {},
    [pageProperties]
  );

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
      "id",
    ];
    const notEditable = ["blockTitle", "block", "page", "is", "content"];
    const columnKeys = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => columnKeys.add(k)));
    fieldProperties &&
      Object.keys(fieldProperties).forEach((k) => columnKeys.add(k));
    columnKeys.delete("block");
    const columnDefs = [...columnKeys].map((k): ColDef<any> => {
      const commonColDefs: ColDef<any> = {
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
        headerName: k,
        editable: (params) => {
          if (params.node.rowPinned) {
            return true;
          } else {
            return !notEditable.includes(k);
          }
        },
      };
      let type;
      let inputValues: string[];
      if (k === "blockTitle") {
        type = "blockTitle";
      } else if (fieldProperties[k]) {
        const fieldConfig = fieldProperties[k] as string;
        const inputType = fieldConfig.split(" ")[0].split("(")[0];
        inputValues = fieldConfig.split("(")[1]?.split(")")[0]?.split(";");
        type = inputType;
      } else {
        type = "default";
      }

      switch (type) {
        case "blockTitle":
          return {
            ...commonColDefs,
            pinned: "left",
            width: 300,
            headerName: "Block",
            cellRenderer: "agGroupCellRenderer",
          };
        case "text": {
          return {
            ...commonColDefs,
            cellRenderer: ({ value }) => {
              return <div>{value}</div>;
            },
          };
        }
        case "longtext": {
          return {
            ...commonColDefs,
            cellEditorPopup: true,
            cellEditor: "agLargeTextCellEditor",
            cellRenderer: ({ value }) => {
              return <div>{value}</div>;
            },
          };
        }
        case "ref":
          return {
            ...commonColDefs,
            cellEditor: RefCellEditor,
            cellRenderer: RefCellRenderer,
            cellEditorParams: {
              type: inputValues[0],
            },
          };
        case "select": {
          return {
            ...commonColDefs,
            cellEditor: "agSelectCellEditor",
            cellEditorParams: {
              values: inputValues,
            },
            cellRenderer: ({ value }) => {
              return (
                <div style={{ display: "flex", alignItems: "center" }}>
                  {value && (
                    <div
                      style={{
                        backgroundColor: "#aaaaaa55",
                        paddingLeft: 4,
                        paddingRight: 4,
                        borderRadius: 6,
                        marginTop: 4,
                        height: 32,
                        marginBottom: 2,
                      }}
                    >
                      {value}
                    </div>
                  )}
                </div>
              );
            },
          };
        }
        case "url": {
          return {
            ...commonColDefs,
            cellRenderer: ({ value }) => {
              return (
                <a
                  style={{ textDecoration: "underline" }}
                  target="_blank"
                  rel="nofollow noreferrer"
                  href={value}
                >
                  {value}
                </a>
              );
            },
          };
        }
        case "color": {
          return {
            ...commonColDefs,
            cellRenderer: ({ value }) => {
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    fontFamily: "monospace",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: value,
                      width: 20,
                      height: 20,
                      marginRight: 8,
                    }}
                  />
                  <div>{value}</div>
                </div>
              );
            },
          };
        }
        case "number": {
          return {
            ...commonColDefs,
            cellEditor: NumberCellEditor,
            cellRenderer: NumberCellRenderer,
          };
        }
        case "date": {
          return {
            ...commonColDefs,
            cellEditor: DateCellEditor,
            cellRenderer: DateCellRenderer,
          };
        }
        case "image": {
          return {
            ...commonColDefs,
            cellRenderer: ({ value }) => {
              return (
                <div>
                  <img
                    src={value}
                    style={{ width: "100%", height: 40, objectFit: "contain" }}
                  />
                </div>
              );
            },
          };
        }
        default:
          return commonColDefs;
      }
    });

    return columnDefs;
  }, [rows, fieldProperties]);
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
    return (
      <div>
        <DataTable data={data} refetch={refetch} type={type} />
      </div>
    );
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
