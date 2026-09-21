import React, {
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileScan,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  RefreshCw,
  ScanLine,
  Trash2,
  Upload,
  AlertTriangle,
  Cpu,
  Pencil,
} from "lucide-react";

import {
  prepareDNVisionImage,
  formatDNVisionBytes,
} from "./DNVisionImagePrep";

import {
  checkDNVisionDevice,
  getDNVisionDeviceSummary,
} from "./DNVisionDeviceCheck";

import {
  askDNVision,
} from "./DNVisionEngine";


/* ============================================================
   EMPTY DELIVERY NOTE
============================================================ */

function createEmptyDeliveryNote() {
  return {
    deliveryNoteNumber: "",
    shippingDate: "",
    sourceLocation: "",
    destinationLocation: "",

    items: [],
  };
}


/* ============================================================
   EXTRACTION INSTRUCTION
============================================================ */

const DNVISION_EXTRACTION_PROMPT = `
You are reading a delivery note document.

Look carefully at the entire delivery note image.

Extract the following information:

1. Delivery Note Number
2. Shipping Date
3. Source Location
4. Destination Location

Then read every product row in the product table.

For every product extract:

- SKU or product code
- Product description
- Ordered quantity
- Ordered unit of measure
- Delivered quantity
- Delivered unit of measure

IMPORTANT RULES:

- Read only information visible in the document.
- Do not invent missing information.
- Preserve SKU codes exactly.
- Preserve decimal quantities.
- Ignore Arabic text when an English product description is available.
- Do not include company address, VAT number, CR number, email address or footer information.
- Read ALL product rows.
- Ordered and delivered values must be kept separately.
- If a field cannot be read, return an empty string.
- Return ONLY valid JSON.
- Do not use markdown.
- Do not use code fences.
- Do not explain the answer.
- Do not write text before or after the JSON.

Return exactly this structure:

{
  "deliveryNoteNumber": "",
  "shippingDate": "",
  "sourceLocation": "",
  "destinationLocation": "",
  "items": [
    {
      "sku": "",
      "description": "",
      "orderedQuantity": "",
      "orderedUom": "",
      "deliveredQuantity": "",
      "deliveredUom": ""
    }
  ]
}
`.trim();


/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function DNVisionScanner({
  branch,
  onBack,
}) {

  const fileInputRef =
    useRef(null);


  /* ==========================================================
     IMAGE STATE
  ========================================================== */

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);


  const [
    preparedImage,
    setPreparedImage,
  ] = useState(null);


  const [
    previewURL,
    setPreviewURL,
  ] = useState("");


  /* ==========================================================
     DEVICE
  ========================================================== */

  const [
    deviceInfo,
    setDeviceInfo,
  ] = useState(null);


  /* ==========================================================
     AI
  ========================================================== */

  const [
    scanning,
    setScanning,
  ] = useState(false);


  const [
    aiProgress,
    setAiProgress,
  ] = useState(null);


  const [
    status,
    setStatus,
  ] = useState("");


  const [
    error,
    setError,
  ] = useState("");


  const [
    rawAnswer,
    setRawAnswer,
  ] = useState("");


  /* ==========================================================
     RESULT
  ========================================================== */

  const [
    deliveryNote,
    setDeliveryNote,
  ] = useState(
    createEmptyDeliveryNote()
  );


  const [
    scanComplete,
    setScanComplete,
  ] = useState(false);


  /* ==========================================================
     DEVICE CHECK
  ========================================================== */

  React.useEffect(() => {

    let mounted = true;


    async function runCheck() {

      try {

        const info =
          await checkDNVisionDevice();


        if (mounted) {
          setDeviceInfo(info);
        }

      } catch (err) {

        console.error(
          "DNVision device check:",
          err
        );
      }
    }


    runCheck();


    return () => {
      mounted = false;
    };

  }, []);


  /* ==========================================================
     DEVICE SUMMARY
  ========================================================== */

  const deviceSummary =
    useMemo(() => {

      if (!deviceInfo) {
        return null;
      }


      try {

        return getDNVisionDeviceSummary(
          deviceInfo
        );

      } catch {

        return null;
      }

    }, [deviceInfo]);


  /* ==========================================================
     SELECT IMAGE
  ========================================================== */

  async function handleFileChange(
    event
  ) {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    await loadImage(
      file
    );


    event.target.value =
      "";
  }


  /* ==========================================================
     PREPARE IMAGE
  ========================================================== */

  async function loadImage(
    file
  ) {

    setError("");
    setStatus(
      "Preparing delivery note image..."
    );

    setScanComplete(false);

    setRawAnswer("");

    setDeliveryNote(
      createEmptyDeliveryNote()
    );


    try {

      const prepared =
        await prepareDNVisionImage(
          file
        );


      setSelectedFile(
        file
      );


      setPreparedImage(
        prepared
      );


      setPreviewURL(
        prepared.dataUrl
      );


      setStatus(
        "Image ready for DNVision."
      );

    } catch (err) {

      console.error(
        "DNVision image preparation:",
        err
      );


      setError(
        err?.message ||
        "Unable to prepare image."
      );


      setStatus("");
    }
  }


  /* ==========================================================
     REMOVE IMAGE
  ========================================================== */

  function clearImage() {

    if (scanning) {
      return;
    }


    setSelectedFile(
      null
    );

    setPreparedImage(
      null
    );

    setPreviewURL("");

    setRawAnswer("");

    setDeliveryNote(
      createEmptyDeliveryNote()
    );

    setScanComplete(
      false
    );

    setError("");

    setStatus("");

    setAiProgress(
      null
    );
  }


  /* ==========================================================
     SCAN DELIVERY NOTE
  ========================================================== */

  async function scanDeliveryNote() {

    if (
      !preparedImage?.blob
    ) {

      setError(
        "Please select a delivery note image first."
      );

      return;
    }


    setScanning(
      true
    );

    setScanComplete(
      false
    );

    setError("");

    setRawAnswer("");

    setAiProgress(
      null
    );


    try {

      const result =
        await askDNVision(
          preparedImage.blob,
          DNVISION_EXTRACTION_PROMPT,

          (
            progressInfo
          ) => {

            if (
              typeof progressInfo?.progress ===
              "number"
            ) {

              setAiProgress(
                progressInfo.progress
              );
            }


            if (
              progressInfo?.message
            ) {

              setStatus(
                progressInfo.message
              );
            }
          }
        );


      const answer =
        String(
          result?.answer ||
          ""
        ).trim();


      setRawAnswer(
        answer
      );


      if (!answer) {

        throw new Error(
          "DNVision returned an empty result."
        );
      }


      const parsed =
        parseDNVisionResult(
          answer
        );


      setDeliveryNote(
        parsed
      );


      setScanComplete(
        true
      );


      setAiProgress(
        100
      );


      setStatus(
        "Delivery note read successfully."
      );

    } catch (err) {

      console.error(
        "DNVision scan:",
        err
      );


      setError(
        err?.message ||
        "DNVision could not read this delivery note."
      );


      setStatus("");

    } finally {

      setScanning(
        false
      );
    }
  }


  /* ==========================================================
     HEADER FIELD CHANGE
  ========================================================== */

  function updateHeaderField(
    field,
    value
  ) {

    setDeliveryNote(
      (current) => ({
        ...current,

        [field]:
          value,
      })
    );
  }


  /* ==========================================================
     ITEM CHANGE
  ========================================================== */

  function updateItem(
    index,
    field,
    value
  ) {

    setDeliveryNote(
      (current) => {

        const items =
          [...current.items];


        items[index] = {
          ...items[index],

          [field]:
            value,
        };


        return {
          ...current,
          items,
        };
      }
    );
  }


  /* ==========================================================
     REMOVE ITEM
  ========================================================== */

  function removeItem(
    index
  ) {

    setDeliveryNote(
      (current) => ({
        ...current,

        items:
          current.items.filter(
            (
              _,
              itemIndex
            ) =>
              itemIndex !==
              index
          ),
      })
    );
  }


  /* ==========================================================
     ADD ITEM
  ========================================================== */

  function addItem() {

    setDeliveryNote(
      (current) => ({
        ...current,

        items: [
          ...current.items,

          {
            sku: "",
            description: "",
            orderedQuantity: "",
            orderedUom: "",
            deliveredQuantity: "",
            deliveredUom: "",
          },
        ],
      })
    );
  }


  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div
      style={{
        minHeight:
          "100vh",

        background:
          "#f4f7fb",

        padding:
          "24px",
      }}
    >

      <div
        style={{
          width:
            "min(1100px, 100%)",

          margin:
            "0 auto",

          background:
            "#ffffff",

          borderRadius:
            "26px",

          boxShadow:
            "0 20px 60px rgba(15,23,42,0.08)",

          overflow:
            "hidden",

          border:
            "1px solid #e2e8f0",
        }}
      >

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div
          style={{
            padding:
              "26px",

            borderBottom:
              "1px solid #e2e8f0",

            display:
              "flex",

            alignItems:
              "center",

            gap:
              "16px",
          }}
        >

          <button
            type="button"
            onClick={
              onBack
            }
            style={
              iconButtonStyle
            }
          >
            <ArrowLeft
              size={20}
            />
          </button>


          <div
            style={{
              width:
                "48px",

              height:
                "48px",

              borderRadius:
                "15px",

              display:
                "grid",

              placeItems:
                "center",

              background:
                "#0f172a",

              color:
                "#ffffff",
            }}
          >
            <FileScan
              size={24}
            />
          </div>


          <div
            style={{
              flex: 1,
            }}
          >

            <div
              style={{
                fontSize:
                  "12px",

                fontWeight:
                  800,

                letterSpacing:
                  "1.3px",

                color:
                  "#64748b",
              }}
            >
              DNVISION
            </div>


            <h1
              style={{
                margin:
                  "3px 0 0",

                fontSize:
                  "24px",

                color:
                  "#0f172a",
              }}
            >
              Delivery Note Scanner
            </h1>


            <div
              style={{
                marginTop:
                  "4px",

                fontSize:
                  "13px",

                color:
                  "#64748b",
              }}
            >
              {branch?.name ||
                branch?.code ||
                "Branch"}
            </div>

          </div>

        </div>


        {/* ====================================================
            BODY
        ==================================================== */}

        <div
          style={{
            padding:
              "26px",
          }}
        >

          {/* ==================================================
              DEVICE
          ================================================== */}

          {deviceSummary && (

            <div
              style={{
                ...cardStyle,

                marginBottom:
                  "20px",

                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "14px",
              }}
            >

              <div
                style={{
                  ...smallIconStyle,

                  background:
                    "#eef2ff",

                  color:
                    "#4338ca",
                }}
              >
                <Cpu
                  size={20}
                />
              </div>


              <div>

                <div
                  style={{
                    fontWeight:
                      800,

                    color:
                      "#0f172a",
                  }}
                >
                  DNVision Device Engine
                </div>


                <div
                  style={{
                    marginTop:
                      "3px",

                    fontSize:
                      "13px",

                    color:
                      "#64748b",
                  }}
                >
                  {deviceInfo?.recommendedMode ||
                    "WEBGPU"}
                  {" • "}

                  {deviceInfo?.hardwareConcurrency ||
                    "?"}
                  {" CPU Threads"}
                </div>

              </div>

            </div>

          )}


          {/* ==================================================
              UPLOAD
          ================================================== */}

          {!previewURL && (

            <div
              style={{
                border:
                  "2px dashed #cbd5e1",

                borderRadius:
                  "22px",

                padding:
                  "52px 24px",

                textAlign:
                  "center",

                background:
                  "#f8fafc",
              }}
            >

              <div
                style={{
                  width:
                    "66px",

                  height:
                    "66px",

                  borderRadius:
                    "20px",

                  display:
                    "grid",

                  placeItems:
                    "center",

                  margin:
                    "0 auto 18px",

                  background:
                    "#0f172a",

                  color:
                    "#ffffff",
                }}
              >
                <Camera
                  size={30}
                />
              </div>


              <h2
                style={{
                  margin:
                    "0 0 8px",

                  color:
                    "#0f172a",
                }}
              >
                Scan Delivery Note
              </h2>


              <p
                style={{
                  margin:
                    "0 auto 22px",

                  maxWidth:
                    "500px",

                  color:
                    "#64748b",

                  lineHeight:
                    1.6,
                }}
              >
                Take a clear photo of the complete
                delivery note. Keep the product table
                visible and avoid strong shadows.
              </p>


              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                style={
                  primaryButtonStyle
                }
              >
                <Upload
                  size={18}
                />

                Select / Take Photo
              </button>

            </div>

          )}


          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/*"
            capture="environment"
            onChange={
              handleFileChange
            }
            style={{
              display:
                "none",
            }}
          />


          {/* ==================================================
              IMAGE PREVIEW
          ================================================== */}

          {previewURL && (

            <div>

              <div
                style={{
                  ...cardStyle,

                  padding:
                    "16px",
                }}
              >

                <div
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "space-between",

                    gap:
                      "12px",

                    marginBottom:
                      "14px",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",

                      alignItems:
                        "center",

                      gap:
                        "10px",
                    }}
                  >

                    <ImageIcon
                      size={19}
                    />


                    <div>

                      <div
                        style={{
                          fontWeight:
                            800,

                          color:
                            "#0f172a",
                        }}
                      >
                        Delivery Note Image
                      </div>


                      <div
                        style={{
                          fontSize:
                            "12px",

                          color:
                            "#64748b",

                          marginTop:
                            "2px",
                        }}
                      >
                        {preparedImage?.width}
                        ×
                        {preparedImage?.height}

                        {" • "}

                        {formatDNVisionBytes(
                          preparedImage?.processedSize
                        )}
                      </div>

                    </div>

                  </div>


                  {!scanning && (

                    <button
                      type="button"
                      onClick={
                        clearImage
                      }
                      style={
                        dangerIconButtonStyle
                      }
                    >
                      <Trash2
                        size={18}
                      />
                    </button>

                  )}

                </div>


                <div
                  style={{
                    background:
                      "#eef2f7",

                    borderRadius:
                      "16px",

                    overflow:
                      "hidden",

                    textAlign:
                      "center",
                  }}
                >

                  <img
                    src={
                      previewURL
                    }
                    alt="Delivery Note"
                    style={{
                      display:
                        "block",

                      maxWidth:
                        "100%",

                      maxHeight:
                        "720px",

                      margin:
                        "0 auto",

                      objectFit:
                        "contain",
                    }}
                  />

                </div>

              </div>


              {/* ==============================================
                  SCAN BUTTON
              ============================================== */}

              {!scanComplete && (

                <div
                  style={{
                    marginTop:
                      "22px",
                  }}
                >

                  <button
                    type="button"
                    disabled={
                      scanning
                    }
                    onClick={
                      scanDeliveryNote
                    }
                    style={{
                      ...primaryButtonStyle,

                      width:
                        "100%",

                      minHeight:
                        "58px",

                      justifyContent:
                        "center",

                      opacity:
                        scanning
                          ? 0.75
                          : 1,
                    }}
                  >

                    {scanning ? (

                      <>
                        <Loader2
                          size={20}
                          className="dnvision-spin"
                        />

                        DNVision Reading...
                      </>

                    ) : (

                      <>
                        <ScanLine
                          size={20}
                        />

                        Read With DNVision
                      </>

                    )}

                  </button>

                </div>

              )}


              {/* ==============================================
                  PROGRESS
              ============================================== */}

              {scanning && (

                <div
                  style={{
                    ...cardStyle,

                    marginTop:
                      "16px",
                  }}
                >

                  <div
                    style={{
                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      gap:
                        "12px",

                      marginBottom:
                        "10px",
                    }}
                  >

                    <strong>
                      {status ||
                        "DNVision working..."}
                    </strong>


                    {typeof aiProgress ===
                      "number" && (

                      <span>
                        {aiProgress}%
                      </span>

                    )}

                  </div>


                  <div
                    style={{
                      height:
                        "9px",

                      borderRadius:
                        "999px",

                      background:
                        "#e2e8f0",

                      overflow:
                        "hidden",
                    }}
                  >

                    <div
                      style={{
                        height:
                          "100%",

                        width:
                          `${
                            typeof aiProgress ===
                            "number"
                              ? aiProgress
                              : 15
                          }%`,

                        background:
                          "#0f172a",

                        transition:
                          "width .25s ease",
                      }}
                    />

                  </div>

                </div>

              )}


              {/* ==============================================
                  ERROR
              ============================================== */}

              {error && (

                <div
                  style={{
                    marginTop:
                      "16px",

                    padding:
                      "16px",

                    borderRadius:
                      "15px",

                    background:
                      "#fff1f2",

                    border:
                      "1px solid #fecdd3",

                    color:
                      "#9f1239",

                    display:
                      "flex",

                    gap:
                      "10px",

                    alignItems:
                      "flex-start",
                  }}
                >

                  <AlertTriangle
                    size={20}
                  />


                  <div
                    style={{
                      fontWeight:
                        700,
                    }}
                  >
                    {error}
                  </div>

                </div>

              )}

            </div>

          )}


          {/* ==================================================
              REVIEW
          ================================================== */}

          {scanComplete && (

            <div
              style={{
                marginTop:
                  "24px",
              }}
            >

              <div
                style={{
                  padding:
                    "18px",

                  borderRadius:
                    "18px",

                  background:
                    "#ecfdf5",

                  border:
                    "1px solid #a7f3d0",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    "12px",

                  marginBottom:
                    "20px",
                }}
              >

                <CheckCircle2
                  size={24}
                />


                <div>

                  <div
                    style={{
                      fontWeight:
                        900,

                      color:
                        "#065f46",
                    }}
                  >
                    DNVision Scan Complete
                  </div>


                  <div
                    style={{
                      marginTop:
                        "3px",

                      color:
                        "#047857",

                      fontSize:
                        "13px",
                    }}
                  >
                    Please verify every field before
                    submission.
                  </div>

                </div>

              </div>


              {/* ==============================================
                  HEADER DETAILS
              ============================================== */}

              <section
                style={
                  sectionStyle
                }
              >

                <SectionTitle
                  icon={
                    <Pencil
                      size={19}
                    />
                  }
                  title="Delivery Note Details"
                  subtitle="Check the detected document information."
                />


                <div
                  style={
                    formGridStyle
                  }
                >

                  <Field
                    label="Delivery Note No."
                    value={
                      deliveryNote.deliveryNoteNumber
                    }
                    onChange={
                      (value) =>
                        updateHeaderField(
                          "deliveryNoteNumber",
                          value
                        )
                    }
                  />


                  <Field
                    label="Shipping Date"
                    value={
                      deliveryNote.shippingDate
                    }
                    onChange={
                      (value) =>
                        updateHeaderField(
                          "shippingDate",
                          value
                        )
                    }
                  />


                  <Field
                    label="Source Location"
                    value={
                      deliveryNote.sourceLocation
                    }
                    onChange={
                      (value) =>
                        updateHeaderField(
                          "sourceLocation",
                          value
                        )
                    }
                  />


                  <Field
                    label="Destination Location"
                    value={
                      deliveryNote.destinationLocation
                    }
                    onChange={
                      (value) =>
                        updateHeaderField(
                          "destinationLocation",
                          value
                        )
                    }
                  />

                </div>

              </section>


              {/* ==============================================
                  ITEMS
              ============================================== */}

              <section
                style={{
                  ...sectionStyle,

                  marginTop:
                    "20px",
                }}
              >

                <SectionTitle
                  icon={
                    <PackageCheck
                      size={20}
                    />
                  }
                  title={`Detected Items (${deliveryNote.items.length})`}
                  subtitle="Verify SKU, description and quantities."
                />


                <div
                  style={{
                    display:
                      "grid",

                    gap:
                      "14px",
                  }}
                >

                  {deliveryNote.items.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        key={
                          `${index}-${item.sku}`
                        }
                        style={
                          itemCardStyle
                        }
                      >

                        <div
                          style={{
                            display:
                              "flex",

                            justifyContent:
                              "space-between",

                            alignItems:
                              "center",

                            gap:
                              "10px",

                            marginBottom:
                              "14px",
                          }}
                        >

                          <strong
                            style={{
                              color:
                                "#0f172a",
                            }}
                          >
                            Item {index + 1}
                          </strong>


                          <button
                            type="button"
                            onClick={() =>
                              removeItem(
                                index
                              )
                            }
                            style={
                              dangerIconButtonStyle
                            }
                          >
                            <Trash2
                              size={17}
                            />
                          </button>

                        </div>


                        <div
                          style={
                            itemGridStyle
                          }
                        >

                          <Field
                            label="SKU"
                            value={
                              item.sku
                            }
                            onChange={
                              (value) =>
                                updateItem(
                                  index,
                                  "sku",
                                  value
                                )
                            }
                          />


                          <Field
                            label="Description"
                            value={
                              item.description
                            }
                            onChange={
                              (value) =>
                                updateItem(
                                  index,
                                  "description",
                                  value
                                )
                            }
                            wide
                          />


                          <Field
                            label="Ordered Qty"
                            value={
                              item.orderedQuantity
                            }
                            onChange={
                              (value) =>
                                updateItem(
                                  index,
                                  "orderedQuantity",
                                  value
                                )
                            }
                          />


                          <Field
                            label="Ordered UOM"
                            value={
                              item.orderedUom
                            }
                            onChange={
                              (value) =>
                                updateItem(
                                  index,
                                  "orderedUom",
                                  value
                                )
                            }
                          />


                          <Field
                            label="Delivered Qty"
                            value={
                              item.deliveredQuantity
                            }
                            onChange={
                              (value) =>
                                updateItem(
                                  index,
                                  "deliveredQuantity",
                                  value
                                )
                            }
                          />


                          <Field
                            label="Delivered UOM"
                            value={
                              item.deliveredUom
                            }
                            onChange={
                              (value) =>
                                updateItem(
                                  index,
                                  "deliveredUom",
                                  value
                                )
                            }
                          />

                        </div>

                      </div>

                    )
                  )}

                </div>


                <button
                  type="button"
                  onClick={
                    addItem
                  }
                  style={{
                    ...secondaryButtonStyle,

                    marginTop:
                      "16px",
                  }}
                >
                  + Add Missing Item
                </button>

              </section>


              {/* ==============================================
                  ACTIONS
              ============================================== */}

              <div
                style={{
                  display:
                    "flex",

                  gap:
                    "12px",

                  flexWrap:
                    "wrap",

                  marginTop:
                    "22px",
                }}
              >

                <button
                  type="button"
                  onClick={
                    scanDeliveryNote
                  }
                  disabled={
                    scanning
                  }
                  style={
                    secondaryButtonStyle
                  }
                >
                  <RefreshCw
                    size={18}
                  />

                  Scan Again
                </button>


                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  style={
                    secondaryButtonStyle
                  }
                >
                  <Camera
                    size={18}
                  />

                  New Photo
                </button>


                <button
                  type="button"
                  onClick={() => {
                    console.log(
                      "DNVision verified delivery note:",
                      deliveryNote
                    );

                    alert(
                      "Verification complete. Submission connection is the next step."
                    );
                  }}
                  style={{
                    ...primaryButtonStyle,

                    marginLeft:
                      "auto",
                  }}
                >
                  <CheckCircle2
                    size={19}
                  />

                  Confirm Verified Data
                </button>

              </div>

            </div>

          )}

        </div>

      </div>


      {/* ======================================================
          LOCAL ANIMATION
      ====================================================== */}

      <style>
        {`
          @keyframes dnvisionSpin {
            to {
              transform: rotate(360deg);
            }
          }

          .dnvision-spin {
            animation: dnvisionSpin 0.9s linear infinite;
          }

          @media (max-width: 700px) {
            .dnvision-responsive-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>

    </div>
  );
}


/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  value,
  onChange,
  wide = false,
}) {

  return (
    <label
      style={{
        display:
          "grid",

        gap:
          "7px",

        gridColumn:
          wide
            ? "span 2"
            : "auto",
      }}
    >

      <span
        style={{
          fontSize:
            "12px",

          fontWeight:
            800,

          color:
            "#64748b",

          textTransform:
            "uppercase",

          letterSpacing:
            ".5px",
        }}
      >
        {label}
      </span>


      <input
        value={
          value ?? ""
        }
        onChange={
          (event) =>
            onChange(
              event.target.value
            )
        }
        style={
          inputStyle
        }
      />

    </label>
  );
}


/* ============================================================
   SECTION TITLE
============================================================ */

function SectionTitle({
  icon,
  title,
  subtitle,
}) {

  return (
    <div
      style={{
        display:
          "flex",

        gap:
          "12px",

        alignItems:
          "flex-start",

        marginBottom:
          "18px",
      }}
    >

      <div
        style={
          smallIconStyle
        }
      >
        {icon}
      </div>


      <div>

        <h2
          style={{
            margin:
              0,

            fontSize:
              "18px",

            color:
              "#0f172a",
          }}
        >
          {title}
        </h2>


        <div
          style={{
            marginTop:
              "4px",

            color:
              "#64748b",

            fontSize:
              "13px",
          }}
        >
          {subtitle}
        </div>

      </div>

    </div>
  );
}


/* ============================================================
   RESULT PARSER
============================================================ */

function parseDNVisionResult(
  raw
) {

  const cleaned =
    cleanDNVisionJSON(
      raw
    );


  let data;


  try {

    data =
      JSON.parse(
        cleaned
      );

  } catch (error) {

    console.error(
      "DNVision raw answer:",
      raw
    );


    console.error(
      "DNVision cleaned answer:",
      cleaned
    );


    throw new Error(
      "DNVision read the document but returned an invalid data format. Please scan again."
    );
  }


  const result =
    createEmptyDeliveryNote();


  result.deliveryNoteNumber =
    normalizeDeliveryNoteNumber(
      data?.deliveryNoteNumber
    );


  result.shippingDate =
    safeText(
      data?.shippingDate
    );


  result.sourceLocation =
    safeText(
      data?.sourceLocation
    );


  result.destinationLocation =
    safeText(
      data?.destinationLocation
    );


  const sourceItems =
    Array.isArray(
      data?.items
    )
      ? data.items
      : [];


  result.items =
    sourceItems
      .map(
        (item) => ({

          sku:
            normalizeSKU(
              item?.sku
            ),

          description:
            safeText(
              item?.description
            ),

          orderedQuantity:
            normalizeQuantity(
              item?.orderedQuantity
            ),

          orderedUom:
            safeText(
              item?.orderedUom
            ),

          deliveredQuantity:
            normalizeQuantity(
              item?.deliveredQuantity
            ),

          deliveredUom:
            safeText(
              item?.deliveredUom
            ),
        })
      )
      .filter(
        (item) =>
          item.sku ||
          item.description ||
          item.orderedQuantity ||
          item.deliveredQuantity
      );


  return result;
}


/* ============================================================
   CLEAN MODEL JSON
============================================================ */

function cleanDNVisionJSON(
  raw
) {

  let text =
    String(
      raw || ""
    ).trim();


  /*
    Remove Markdown fences if model ignores
    the instruction and returns ```json.
  */

  text =
    text
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/,
        ""
      )
      .replace(
        /\s*```$/,
        ""
      )
      .trim();


  /*
    Remove accidental assistant prefix.
  */

  text =
    text.replace(
      /^assistant\s*:?\s*/i,
      ""
    );


  /*
    Find first JSON object.

    This protects us if the model writes
    a short sentence before the JSON.
  */

  const firstBrace =
    text.indexOf(
      "{"
    );


  const lastBrace =
    text.lastIndexOf(
      "}"
    );


  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace >
    firstBrace
  ) {

    text =
      text.slice(
        firstBrace,
        lastBrace + 1
      );
  }


  return text.trim();
}


/* ============================================================
   DELIVERY NOTE NORMALIZATION
============================================================ */

function normalizeDeliveryNoteNumber(
  value
) {

  let text =
    safeText(
      value
    )
      .toUpperCase()
      .replace(
        /^DELIVERY\s*NOTE\s*/i,
        ""
      )
      .trim();


  /*
    Example model output:

    CKWH/INT 46389

    becomes:

    CKWH/INT/46389
  */

  if (
    /^[A-Z0-9]+\/[A-Z0-9]+\s+\d+$/.test(
      text
    )
  ) {

    text =
      text.replace(
        /\s+(?=\d+$)/,
        "/"
      );
  }


  text =
    text
      .replace(
        /\s*\/\s*/g,
        "/"
      )
      .replace(
        /\/+/g,
        "/"
      )
      .trim();


  return text;
}


/* ============================================================
   SKU NORMALIZATION
============================================================ */

function normalizeSKU(
  value
) {

  return safeText(
    value
  )
    .toUpperCase()
    .replace(
      /\s+/g,
      ""
    );
}


/* ============================================================
   QUANTITY NORMALIZATION
============================================================ */

function normalizeQuantity(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  return String(
    value
  ).trim();
}


/* ============================================================
   SAFE TEXT
============================================================ */

function safeText(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }


  return String(
    value
  ).trim();
}


/* ============================================================
   STYLES
============================================================ */

const cardStyle = {
  padding:
    "18px",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "18px",

  background:
    "#ffffff",
};


const sectionStyle = {
  padding:
    "20px",

  border:
    "1px solid #e2e8f0",

  borderRadius:
    "20px",

  background:
    "#ffffff",
};


const itemCardStyle = {
  padding:
    "17px",

  borderRadius:
    "17px",

  border:
    "1px solid #e2e8f0",

  background:
    "#f8fafc",
};


const formGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",

  gap:
    "15px",
};


const itemGridStyle = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(150px, 1fr))",

  gap:
    "13px",
};


const inputStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  minHeight:
    "44px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "11px",

  padding:
    "10px 12px",

  background:
    "#ffffff",

  color:
    "#0f172a",

  fontSize:
    "14px",

  outline:
    "none",
};


const primaryButtonStyle = {
  border:
    "none",

  borderRadius:
    "13px",

  minHeight:
    "46px",

  padding:
    "0 20px",

  background:
    "#0f172a",

  color:
    "#ffffff",

  fontWeight:
    800,

  cursor:
    "pointer",

  display:
    "inline-flex",

  alignItems:
    "center",

  gap:
    "9px",
};


const secondaryButtonStyle = {
  border:
    "1px solid #cbd5e1",

  borderRadius:
    "13px",

  minHeight:
    "46px",

  padding:
    "0 18px",

  background:
    "#ffffff",

  color:
    "#0f172a",

  fontWeight:
    800,

  cursor:
    "pointer",

  display:
    "inline-flex",

  alignItems:
    "center",

  gap:
    "8px",
};


const iconButtonStyle = {
  width:
    "44px",

  height:
    "44px",

  borderRadius:
    "13px",

  border:
    "1px solid #e2e8f0",

  background:
    "#ffffff",

  color:
    "#0f172a",

  cursor:
    "pointer",

  display:
    "grid",

  placeItems:
    "center",
};


const dangerIconButtonStyle = {
  width:
    "38px",

  height:
    "38px",

  borderRadius:
    "11px",

  border:
    "1px solid #fecdd3",

  background:
    "#fff1f2",

  color:
    "#be123c",

  cursor:
    "pointer",

  display:
    "grid",

  placeItems:
    "center",
};


const smallIconStyle = {
  width:
    "42px",

  height:
    "42px",

  flex:
    "0 0 42px",

  borderRadius:
    "13px",

  background:
    "#f1f5f9",

  color:
    "#0f172a",

  display:
    "grid",

  placeItems:
    "center",
};
