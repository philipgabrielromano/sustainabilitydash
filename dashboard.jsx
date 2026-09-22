const GOODWILL = {
  blue: '#0854A0',
  navy: '#2C549A',
  periwinkle: '#6387C2',
  sky: '#93C0E8',
  lime: '#BBCF53',
  sage: '#79B88B',
  gold: '#D79D45',
  red: '#B85450',
  bg: '#F7FAFD',
  text: '#17324D',
};
const PALETTE = [GOODWILL.blue, GOODWILL.lime, GOODWILL.sage, GOODWILL.gold, GOODWILL.sky, GOODWILL.periwinkle, GOODWILL.navy];
const MODEL = 'snowflake_model';

const DGR_SUMMARY_SQL = `WITH periods AS (
  SELECT 'YTD' AS PERIOD_LABEL, DATE_FROM_PARTS(YEAR(CURRENT_DATE()),1,1) AS START_DATE, CURRENT_DATE() AS END_DATE
  UNION ALL
  SELECT 'Prior YTD', DATE_FROM_PARTS(YEAR(CURRENT_DATE())-1,1,1), DATEADD('year',-1,CURRENT_DATE())
), sales_summary AS (
  SELECT p.PERIOD_LABEL,
         SUM(CASE WHEN st.CHANNEL IN ('Retail','eCommerce') THEN COALESCE(st.REVENUE,0) ELSE 0 END) AS STORE_SALES,
         SUM(CASE WHEN st.CHANNEL='Retail' THEN COALESCE(st.REVENUE,0) ELSE 0 END) AS RETAIL_SALES,
         SUM(CASE WHEN st.CHANNEL='eCommerce' THEN COALESCE(st.REVENUE,0) ELSE 0 END) AS ECOMMERCE_SALES,
         SUM(COALESCE(st.REVENUE,0)) AS TOTAL_SALES
  FROM periods p LEFT JOIN sales_totals st ON st.SALE_DATE BETWEEN p.START_DATE AND p.END_DATE
  GROUP BY 1
), donor_summary AS (
  SELECT p.PERIOD_LABEL, SUM(COALESCE(dt.DONOR_COUNT,0)) AS DONOR_TOTAL
  FROM periods p LEFT JOIN donor_totals dt ON dt.DONOR_DATE BETWEEN p.START_DATE AND p.END_DATE
  GROUP BY 1
), dgr_summary AS (
  SELECT p.PERIOD_LABEL,
         SUM(CASE WHEN UPPER(COALESCE(d.CATEGORY,'')) LIKE 'OUTLET%' THEN COALESCE(d.QTY,0) ELSE 0 END) AS OUTLET_LBS,
         SUM(CASE WHEN UPPER(COALESCE(d.CATEGORY,'')) NOT LIKE 'OUTLET%' THEN COALESCE(d.QTY,0) ELSE 0 END) AS RETAIL_LBS
  FROM periods p LEFT JOIN "MYSQL_AZURE_SALES"."DGR_SALES_LINE" d
    ON TO_DATE(d.TS) BETWEEN p.START_DATE AND p.END_DATE AND COALESCE(d._FIVETRAN_DELETED,FALSE)=FALSE
  GROUP BY 1
), outlet_sales_summary AS (
  SELECT p.PERIOD_LABEL,
         SUM(CASE WHEN st.CHANNEL IN ('Retail','eCommerce') THEN COALESCE(st.REVENUE,0) ELSE 0 END) AS OUTLET_SALES
  FROM periods p
  LEFT JOIN sales_totals st ON st.SALE_DATE BETWEEN p.START_DATE AND p.END_DATE
  LEFT JOIN "MYSQL_AZURE_SALES"."UPLOAD_STORENAME_20240216175319" sm ON st.STORE_ID=sm.STOREID
  WHERE UPPER(COALESCE(sm.STORENAME,'')) LIKE '%OUTLET%' OR UPPER(COALESCE(sm.UPRIGHT,'')) LIKE '%OUTLET%'
  GROUP BY 1
), distribution_summary AS (
  SELECT p.PERIOD_LABEL,
    SUM(
      COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_49_SALVAGE_APPAREL)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_72_SALVAGE_APPAREL_GAYLORDS)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_50_SALVAGE_SHOES)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_51_SALVAGE_WIRES)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_62_SALVAGE_WIRES)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_52_SALVAGE_METAL)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_53_SALVAGE_BOOKS)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_54_SALVAGE_LINENS)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_47_SALVAGE_LINENS)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_61_SALVAGE_LINENS)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_55_SALVAGE_SINGLE_SHOES)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_56_SALVAGE_PURSES_ACCESSORIES)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_57_SALVAGE_KITCHENWARE)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_58_SALVAGE_STUFFIES)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_69_SALVAGE_STUFFIES)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_59_SALVAGE_HARD_PLASTIC_TOYS)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_60_SALVAGE_GLASSWARE)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_71_SALVAGE_GLASSWARE)),0)
    ) AS SALVAGE_LBS,
    SUM(
      COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_81_OUTLET_WARES)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_206_OUTLET_WARES_ALT)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_5_OUTLET_WARES)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_82_OUTLET_APPAREL)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_202_OUTLET_APPAREL_ALT)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_83_OUTLET_SHOES)), TRY_TO_NUMBER(TO_VARCHAR(FIELD_203_OUTLET_SHOES_ALT)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_204_OUTLET_METAL)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_207_OUTLET_ACCESSORIES)),0)
      + COALESCE(TRY_TO_NUMBER(TO_VARCHAR(FIELD_208_OUTLET_ELECTRICAL)),0)
    ) AS FORM_OUTLET_LBS
  FROM periods p LEFT JOIN "MYSQL_AZURE_SALES"."VW_SPOC_FORM_PIVOTED" f
    ON COALESCE(TO_DATE(f.FIELD_2_DATE), TO_DATE(f."date")) BETWEEN p.START_DATE AND p.END_DATE
  GROUP BY 1
), salvage_summary AS (
  SELECT p.PERIOD_LABEL, SUM(CASE WHEN pd.COUNTERPARTY_NAME='TOTAL AFTERMARKET SALVAGE (excludes outlets)' THEN COALESCE(pd.TOTAL_AMOUNT,0) ELSE 0 END) AS SALVAGE_SALES
  FROM periods p LEFT JOIN "PDFINGESTION"."PARSED_DOCUMENTS" pd
    ON COALESCE(TO_DATE(pd.PERIOD_END), TO_DATE(pd.DOCUMENT_DATE)) BETWEEN p.START_DATE AND p.END_DATE AND pd.STATUS='completed' AND pd.FILENAME ILIKE '%Salvage%' AND pd.FILENAME NOT ILIKE '%Outlets%'
  GROUP BY 1
), trash_lines AS (
  SELECT p.PERIOD_LABEL,
         LOWER(COALESCE(li.UNIT,'')) AS UNIT,
         COALESCE(li.QUANTITY,0) AS QUANTITY,
         UPPER(COALESCE(li.CATEGORY,'')||' '||COALESCE(li.DESCRIPTION,'')) AS DESCRIPTION
  FROM periods p
  JOIN "PDFINGESTION"."DOCUMENT_LINE_ITEMS" li
    ON COALESCE(TO_DATE(li.DOCUMENT_DATE), TO_DATE(li.CREATED_AT)) BETWEEN p.START_DATE AND p.END_DATE
  LEFT JOIN "PDFINGESTION"."PARSED_DOCUMENTS" pd ON li.DOCUMENT_ID=pd.DOCUMENT_ID
  WHERE (UPPER(COALESCE(pd.COUNTERPARTY_NAME,'')) LIKE '%REPUBLIC%' OR UPPER(COALESCE(pd.COUNTERPARTY_NAME,'')) LIKE '%KIMBLE%')
    AND UPPER(COALESCE(li.CATEGORY,'')||' '||COALESCE(li.DESCRIPTION,'')) LIKE '%DISPOSAL%'
), trash_summary AS (
  SELECT p.PERIOD_LABEL,
         CASE WHEN SUM(IFF(tl.UNIT IN ('tons','ton') AND tl.QUANTITY BETWEEN 0 AND 100 AND tl.DESCRIPTION LIKE '%DISPOSAL%', 1, 0)) > 0
              THEN SUM(IFF(tl.UNIT IN ('tons','ton') AND tl.QUANTITY BETWEEN 0 AND 100 AND tl.DESCRIPTION LIKE '%DISPOSAL%', tl.QUANTITY * 2000, 0))
              ELSE NULL END AS TRASH_LBS
  FROM periods p LEFT JOIN trash_lines tl ON p.PERIOD_LABEL=tl.PERIOD_LABEL
  GROUP BY 1
)
SELECT s.PERIOD_LABEL, s.STORE_SALES, s.RETAIL_SALES, s.ECOMMERCE_SALES, s.TOTAL_SALES, ds.DONOR_TOTAL,
       ds.DONOR_TOTAL*45 AS DONATED_LBS, gs.OUTLET_LBS AS DGR_OUTLET_LBS, os.OUTLET_SALES,
       xs.SALVAGE_LBS, xs.FORM_OUTLET_LBS, ss.SALVAGE_SALES, ts.TRASH_LBS,
       CASE WHEN ts.TRASH_LBS IS NULL THEN NULL
            ELSE GREATEST(ds.DONOR_TOTAL*45 - gs.OUTLET_LBS - xs.SALVAGE_LBS - ts.TRASH_LBS,0) END AS RETAIL_LBS
FROM sales_summary s JOIN donor_summary ds ON s.PERIOD_LABEL=ds.PERIOD_LABEL
JOIN dgr_summary gs ON s.PERIOD_LABEL=gs.PERIOD_LABEL
JOIN outlet_sales_summary os ON s.PERIOD_LABEL=os.PERIOD_LABEL
JOIN distribution_summary xs ON s.PERIOD_LABEL=xs.PERIOD_LABEL
JOIN salvage_summary ss ON s.PERIOD_LABEL=ss.PERIOD_LABEL
JOIN trash_summary ts ON s.PERIOD_LABEL=ts.PERIOD_LABEL
ORDER BY CASE WHEN s.PERIOD_LABEL='YTD' THEN 1 ELSE 2 END`;

const DGR_CATEGORY_SQL = `WITH category_map AS (
  SELECT DESCRIPTION, COALESCE(NULLIF(DEPT,''), DESCRIPTION) AS CATEGORY_GROUP
  FROM "MYSQL_AZURE_SALES"."DGR_CATEGORIES"
  QUALIFY ROW_NUMBER() OVER (PARTITION BY DESCRIPTION ORDER BY STOREID DESC NULLS LAST, TS DESC) = 1
), periods AS (
  SELECT 'YTD' AS PERIOD_LABEL, DATE_FROM_PARTS(YEAR(CURRENT_DATE()),1,1) AS START_DATE, CURRENT_DATE() AS END_DATE
  UNION ALL
  SELECT 'Prior YTD', DATE_FROM_PARTS(YEAR(CURRENT_DATE())-1,1,1), DATEADD('year',-1,CURRENT_DATE())
)
SELECT p.PERIOD_LABEL, COALESCE(m.CATEGORY_GROUP, d.CATEGORY) AS CATEGORY,
       SUM(COALESCE(d.PRICE,0)-COALESCE(d.DISCOUNT,0)) AS SALES_DOLLARS,
       SUM(COALESCE(d.QTY,0)) AS UNITS
FROM periods p
JOIN "MYSQL_AZURE_SALES"."DGR_SALES_LINE" d ON TO_DATE(d.TS) BETWEEN p.START_DATE AND p.END_DATE AND COALESCE(d._FIVETRAN_DELETED,FALSE)=FALSE
LEFT JOIN category_map m ON m.DESCRIPTION=d.CATEGORY
WHERE UPPER(COALESCE(d.CATEGORY,'')) NOT LIKE 'OUTLET%'
  AND COALESCE(d.CATEGORY,'') NOT IN ('Change Round Up','Gift Card','Found Money','Monetary Donation')
GROUP BY 1,2
HAVING SUM(COALESCE(d.PRICE,0)-COALESCE(d.DISCOUNT,0)) <> 0
ORDER BY p.PERIOD_LABEL, SALES_DOLLARS DESC`;

const SALVAGE_CATEGORY_SQL = `WITH periods AS (
  SELECT 'YTD' AS PERIOD_LABEL, DATE_FROM_PARTS(YEAR(CURRENT_DATE()),1,1) AS START_DATE, CURRENT_DATE() AS END_DATE
  UNION ALL
  SELECT 'Prior YTD', DATE_FROM_PARTS(YEAR(CURRENT_DATE())-1,1,1), DATEADD('year',-1,CURRENT_DATE())
), docs AS (
  SELECT p.PERIOD_LABEL, pd.RAW_PARSED_DATA
  FROM periods p JOIN "PDFINGESTION"."PARSED_DOCUMENTS" pd
    ON TO_DATE(pd.PERIOD_END) BETWEEN p.START_DATE AND p.END_DATE
   AND pd.STATUS='completed' AND pd.FILENAME ILIKE '%Salvage%' AND pd.FILENAME NOT ILIKE '%Outlets%'
), nodes AS (
  SELECT d.PERIOD_LABEL, n.value AS NODE FROM docs d, LATERAL FLATTEN(INPUT => TRY_PARSE_JSON(d.RAW_PARSED_DATA):statement:nodes) n
)
SELECT PERIOD_LABEL, NODE:label::string AS CATEGORY, SUM(NODE:vals:A::float) AS SALES_DOLLARS
FROM nodes
WHERE NODE:role::string='line' AND NODE:section::string='revenue'
  AND UPPER(COALESCE(NODE:label::string,'')) NOT IN ('DONATED GOODS','NEW GOODS','ECOMM/EBOOKS','SALVAGE REVENUE')
  AND UPPER(COALESCE(NODE:label::string,'')) NOT LIKE '%TOTAL%'
GROUP BY 1,2 HAVING SUM(NODE:vals:A::float) <> 0
ORDER BY PERIOD_LABEL, SALES_DOLLARS DESC`;

const WASTE_SQL = `WITH periods AS (
  SELECT 'YTD' AS PERIOD_LABEL, DATE_FROM_PARTS(YEAR(CURRENT_DATE()),1,1) AS START_DATE, CURRENT_DATE() AS END_DATE
  UNION ALL
  SELECT 'Prior YTD', DATE_FROM_PARTS(YEAR(CURRENT_DATE())-1,1,1), DATEADD('year',-1,CURRENT_DATE())
), line_base AS (
  SELECT p.PERIOD_LABEL,
         UPPER(COALESCE(pd.COUNTERPARTY_NAME, li.COUNTERPARTY_NAME, 'UNKNOWN')) AS VENDOR,
         COALESCE(REGEXP_SUBSTR(li.DESCRIPTION, '[A-Za-z ]+,\\s*OH'), REGEXP_SUBSTR(li.DESCRIPTION, 'CSA A[0-9]+'), NULLIF(TRIM(pd.SHIPPING_ADDRESS),''), 'Unassigned') AS LOCATION,
         UPPER(COALESCE(li.CATEGORY,'')||' '||COALESCE(li.DESCRIPTION,'')) AS LABEL,
         LOWER(COALESCE(li.UNIT,'')) AS UNIT,
         COALESCE(li.AMOUNT,0) AS AMOUNT, COALESCE(li.QUANTITY,0) AS QUANTITY
  FROM "PDFINGESTION"."DOCUMENT_LINE_ITEMS" li
  LEFT JOIN "PDFINGESTION"."PARSED_DOCUMENTS" pd ON li.DOCUMENT_ID=pd.DOCUMENT_ID
  JOIN periods p ON COALESCE(TO_DATE(pd.PERIOD_END), TO_DATE(pd.DOCUMENT_DATE), TO_DATE(li.CREATED_AT)) BETWEEN p.START_DATE AND p.END_DATE
  WHERE REGEXP_LIKE(UPPER(COALESCE(li.CATEGORY,'')||' '||COALESCE(li.DESCRIPTION,'')), 'PICKUP|DISPOSAL|RECYCL')
     OR UPPER(COALESCE(pd.COUNTERPARTY_NAME,'')) LIKE '%REPUBLIC%'
     OR UPPER(COALESCE(pd.COUNTERPARTY_NAME,'')) LIKE '%KIMBLE%'
), donor_summary AS (
  SELECT p.PERIOD_LABEL, SUM(COALESCE(dt.DONOR_COUNT,0)) AS DONORS
  FROM periods p LEFT JOIN donor_totals dt ON dt.DONOR_DATE BETWEEN p.START_DATE AND p.END_DATE GROUP BY 1
)
SELECT 'SUMMARY' AS KIND, lb.PERIOD_LABEL, 'Total' AS CATEGORY, SUM(lb.AMOUNT) AS VALUE,
       SUM(CASE WHEN lb.UNIT IN ('tons','ton') THEN lb.QUANTITY ELSE 0 END) AS TONS,
       SUM(CASE WHEN lb.LABEL LIKE '%PICKUP%' THEN lb.QUANTITY ELSE 0 END) AS PICKUPS,
       ds.DONORS,
       SUM(CASE WHEN lb.UNIT IN ('tons','ton') THEN lb.QUANTITY ELSE 0 END) * 2000 / NULLIF(ds.DONORS,0) AS TRASH_LBS_PER_DONOR,
       SUM(CASE WHEN lb.UNIT IN ('tons','ton') THEN lb.QUANTITY ELSE 0 END) / NULLIF(SUM(CASE WHEN lb.LABEL LIKE '%PICKUP%' THEN lb.QUANTITY ELSE 0 END),0) AS TONS_PER_PULL,
       NULL AS VENDOR, NULL AS LOCATION
FROM line_base lb JOIN donor_summary ds ON lb.PERIOD_LABEL=ds.PERIOD_LABEL GROUP BY lb.PERIOD_LABEL, ds.DONORS
UNION ALL
SELECT 'VENDOR', PERIOD_LABEL, VENDOR, SUM(AMOUNT), SUM(CASE WHEN UNIT IN ('tons','ton') THEN QUANTITY ELSE 0 END), SUM(CASE WHEN LABEL LIKE '%PICKUP%' THEN QUANTITY ELSE 0 END), NULL, NULL,
       SUM(CASE WHEN UNIT IN ('tons','ton') THEN QUANTITY ELSE 0 END) / NULLIF(SUM(CASE WHEN LABEL LIKE '%PICKUP%' THEN QUANTITY ELSE 0 END),0), VENDOR, NULL
FROM line_base GROUP BY PERIOD_LABEL, VENDOR
UNION ALL
SELECT 'LOCATION', PERIOD_LABEL, LOCATION, SUM(AMOUNT), SUM(CASE WHEN UNIT IN ('tons','ton') THEN QUANTITY ELSE 0 END), SUM(CASE WHEN LABEL LIKE '%PICKUP%' THEN QUANTITY ELSE 0 END), NULL, NULL,
       SUM(CASE WHEN UNIT IN ('tons','ton') THEN QUANTITY ELSE 0 END) / NULLIF(SUM(CASE WHEN LABEL LIKE '%PICKUP%' THEN QUANTITY ELSE 0 END),0), NULL, LOCATION
FROM line_base GROUP BY PERIOD_LABEL, LOCATION
ORDER BY PERIOD_LABEL, KIND, VALUE DESC`;

function cnClass(...args) { return cn(...args); }
const Card = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cnClass('rounded-xl border border-[#D9E6F2] bg-white shadow-sm', className)} {...props} />);
const Button = React.forwardRef(({ className, variant='default', ...props }, ref) => <button ref={ref} className={cnClass('inline-flex min-h-[44px] items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6387C2]', variant==='default' ? 'bg-[#0854A0] text-white hover:bg-[#2C549A]' : 'border border-[#D9E6F2] bg-white text-[#0854A0] hover:bg-[#F1F7FC]', className)} {...props} />);

const fmtUSD = (v) => `$${Number(v||0).toLocaleString(undefined,{maximumFractionDigits:0})}`;
const fmtNum = (v,d=0) => Number(v||0).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct = (v) => `${Number(v||0).toFixed(1)}%`;
const coerce = (rows, numericKeys) => rows.map(r => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, numericKeys.includes(k) ? (Number(v)||0) : v])));

function LastUpdated({ at }) { return at ? <div className="text-xs text-[#6387C2]">Updated {at.toLocaleTimeString([], {hour:'numeric', minute:'2-digit', timeZoneName:'short'})}</div> : <ValueSkeleton width="128px" height="14px" />; }

function QueryBlock({ sourceId, label, sql, numericKeys, onLoaded, children, skeleton='chart' }) {
  const [rows, setRows] = React.useState(null);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    window.runSQL(sql, { sourceId, label, modelName: MODEL }).then(result => { if (alive) { setRows(coerce(result, numericKeys)); onLoaded?.(); } }).catch(e => { if (alive) setError(e?.message || 'Unable to load data'); });
    return () => { alive = false; };
  }, [sourceId, sql]);
  return <div data-zenlytic-source={sourceId}>
    {error ? <div className="rounded-lg border border-[#F1C4C0] bg-[#FFF7F6] p-4 text-sm text-[#B85450]">{error}</div> : rows === null ? (skeleton==='value' ? <ValueSkeleton width="100%" height="132px" /> : <ChartSkeleton variant="bar" title={label} />) : rows.length===0 ? <div className="rounded-lg border border-[#D9E6F2] bg-white p-6 text-sm text-[#6387C2]">No data available.</div> : children(rows)}
  </div>;
}

function Kpi({ label, value, sub, accent }) { return <Card className="overflow-hidden"><div className="h-1" style={{backgroundColor:accent}}/><div className="p-4"><div className="text-xs font-medium uppercase tracking-wide text-[#6387C2]">{label}</div><div className="mt-1 text-2xl font-semibold text-[#17324D]" style={{fontFamily:'Source Serif Pro, serif'}}>{value}</div><div className="mt-1 text-xs text-[#6387C2]">{sub}</div></div></Card>; }

function ChartPanel({ children, className='' }) { return <div className={cnClass('min-h-[320px] w-full', className)}>{children}</div>; }

function pieOptions(title, data, unit) { return { chart:{type:'pie',backgroundColor:'#FFFFFF'}, title:{text:title,style:{fontFamily:'Source Serif Pro, serif',fontSize:'17px',color:GOODWILL.text}}, exporting:{enabled:false}, credits:{enabled:false}, tooltip:{pointFormat:`<b>{point.name}</b>: {point.y:,.0f} ${unit}<br/>{point.percentage:.1f}%`}, plotOptions:{series:{label:{enabled:false}},pie:{innerSize:'48%',dataLabels:{enabled:true,format:'{point.name}: {point.percentage:.1f}%',style:{fontFamily:'Inter, sans-serif',fontSize:'11px',color:GOODWILL.text}}}}, series:[{name:unit,data,colorByPoint:true,colors:PALETTE}]}; }
function barOptions(title, categories, values, yTitle, color=GOODWILL.blue, dataFormat='{y:,.0f}') { return { chart:{type:'bar',backgroundColor:'#FFFFFF'}, title:{text:title,style:{fontFamily:'Source Serif Pro, serif',fontSize:'17px',color:GOODWILL.text}}, exporting:{enabled:false}, credits:{enabled:false}, xAxis:{categories,labels:{style:{fontFamily:'Inter, sans-serif',fontSize:'11px',color:GOODWILL.text}}}, yAxis:{title:{text:yTitle,style:{fontFamily:'Inter, sans-serif',fontSize:'13px',color:GOODWILL.text}},labels:{style:{fontFamily:'Inter, sans-serif',fontSize:'11px',color:GOODWILL.text}},gridLineColor:'rgba(23,50,77,0.12)'}, legend:{enabled:false}, plotOptions:{series:{label:{enabled:false}},bar:{dataLabels:{enabled:true,format:dataFormat,style:{fontFamily:'Inter, sans-serif',fontSize:'11px',textOutline:'2px #FFFFFF'}}}}, series:[{name:yTitle,data:values,color}]}; }

function DgrTab({ markUpdated }) {
  const [period, setPeriod] = React.useState('YTD');
  return <div className="space-y-5">
    <QueryBlock sourceId="dgr-summary" label="DGR sustainability summary" sql={DGR_SUMMARY_SQL} numericKeys={['STORE_SALES','RETAIL_SALES','ECOMMERCE_SALES','TOTAL_SALES','DONOR_TOTAL','DONATED_LBS','DGR_OUTLET_LBS','RETAIL_LBS','OUTLET_SALES','SALVAGE_LBS','FORM_OUTLET_LBS','SALVAGE_SALES','TRASH_LBS']} onLoaded={markUpdated} skeleton="value">
      {rows => { const r=rows.find(x=>x.PERIOD_LABEL===period)||rows[0]; const prior=rows.find(x=>x.PERIOD_LABEL!=='YTD'); const donorValue=r.DONOR_TOTAL? r.TOTAL_SALES/r.DONOR_TOTAL:0; return <>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#17324D]" style={{fontFamily:'Source Serif Pro, serif'}}>Donated Goods Retail</h2><p className="text-sm text-[#6387C2]">Calendar YTD with aligned prior-year comparison. Donated pounds = 45 × total donors.</p></div><div className="flex gap-2"><Button variant={period==='YTD'?'default':'outline'} onClick={()=>setPeriod('YTD')}>YTD</Button><Button variant={period==='Prior YTD'?'default':'outline'} onClick={()=>setPeriod('Prior YTD')}>Prior YTD</Button></div></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"><Kpi label="Donor value" value={fmtUSD(donorValue)} sub="Total sales per donor" accent={GOODWILL.blue}/><Kpi label="Total donors" value={fmtNum(r.DONOR_TOTAL)} sub="All donor sources" accent={GOODWILL.lime}/><Kpi label="Donated pounds" value={fmtNum(r.DONATED_LBS)} sub="45 pounds per donor" accent={GOODWILL.sage}/><Kpi label="Estimated retail pounds" value={r.RETAIL_LBS==null?'—':fmtNum(r.RETAIL_LBS)} sub={r.RETAIL_LBS==null?'Insufficient validated trash data':'Residual after outlet, salvage, and trash'} accent={GOODWILL.gold}/><Kpi label="Pounds per donor" value="45" sub="Operating assumption" accent={GOODWILL.periwinkle}/></div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Pounds disposition</h3><p className="text-xs text-[#6387C2]">Estimated donated pounds allocated across retail, outlet, salvage, and landfill.</p><ChartPanel><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={pieOptions('Pounds disposition', [{name:'Retail',y:r.RETAIL_LBS},{name:'Outlet',y:r.DGR_OUTLET_LBS},{name:'Salvage',y:r.SALVAGE_LBS},{name:'Trash',y:r.TRASH_LBS}], 'lbs')}/></ChartPanel></div></Card><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Sales value by destination</h3><p className="text-xs text-[#6387C2]">Trash has no sales value, so it appears only in the pounds disposition.</p><ChartPanel><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={pieOptions('Sales value', [{name:'Store sales incl. eCommerce',y:r.STORE_SALES},{name:'Outlet sales',y:r.OUTLET_SALES},{name:'Salvage sales',y:r.SALVAGE_SALES}], '$')}/></ChartPanel></div></Card></div>
        <Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Year-over-year DGR comparison</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-[#0854A0] text-left text-white"><th className="p-2">Metric</th><th className="p-2">YTD</th><th className="p-2">Prior YTD</th><th className="p-2">Change</th></tr></thead><tbody>{[['Total sales','TOTAL_SALES'],['Total donors','DONOR_TOTAL'],['Donated pounds','DONATED_LBS'],['Retail pounds sold','RETAIL_LBS'],['Outlet pounds','DGR_OUTLET_LBS']].map(([label,key],i)=>{const a=rows.find(x=>x.PERIOD_LABEL==='YTD')?.[key]||0,b=prior?.[key]||0,d=b?((a-b)/b)*100:0;const deltaClass=d>=0?'p-2 font-semibold text-[#4D8A5A]':'p-2 font-semibold text-[#B85450]';return <tr key={key} className={i%2===0?'bg-[#F7FAFD]':'bg-white'}><td className="p-2 font-medium text-[#17324D]">{label}</td><td className="p-2">{key==='TOTAL_SALES'?fmtUSD(a):fmtNum(a)}</td><td className="p-2">{key==='TOTAL_SALES'?fmtUSD(b):fmtNum(b)}</td><td className={deltaClass}>{pct(d)}</td></tr>})}</tbody></table></div></div></Card>
      </>}}
    </QueryBlock>
    <QueryBlock sourceId="dgr-category-sales" label="DGR category sales" sql={DGR_CATEGORY_SQL} numericKeys={['SALES_DOLLARS','UNITS']} onLoaded={markUpdated}>
      {rows => { const data=rows.filter(x=>x.PERIOD_LABEL===period).sort((a,b)=>b.SALES_DOLLARS-a.SALES_DOLLARS).slice(0,8); return <Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Retail categories sold</h3><p className="text-xs text-[#6387C2]">Actual dollars and share of category sales, excluding outlet and non-merchandise categories.</p><ChartPanel><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={pieOptions(`Category sales — ${period}`, data.map(x=>({name:x.CATEGORY,y:x.SALES_DOLLARS})), '$')}/></ChartPanel></div></Card>}}
    </QueryBlock>
  </div>;
}

function AftermarketTab({ markUpdated }) {
  const [period, setPeriod] = React.useState('YTD');
  return <div className="space-y-5"><QueryBlock sourceId="aftermarket-summary" label="Aftermarket summary" sql={DGR_SUMMARY_SQL} numericKeys={['STORE_SALES','RETAIL_SALES','ECOMMERCE_SALES','TOTAL_SALES','DONOR_TOTAL','DONATED_LBS','DGR_OUTLET_LBS','RETAIL_LBS','OUTLET_SALES','SALVAGE_LBS','FORM_OUTLET_LBS','SALVAGE_SALES','TRASH_LBS']} onLoaded={markUpdated} skeleton="value">{rows=>{const r=rows.find(x=>x.PERIOD_LABEL===period)||rows[0]; const prior=rows.find(x=>x.PERIOD_LABEL!=='YTD')||rows[0]; const diverted=r.TRASH_LBS==null?null:Math.max(r.DONATED_LBS-r.TRASH_LBS,0), priorDiverted=prior.TRASH_LBS==null?null:Math.max(prior.DONATED_LBS-prior.TRASH_LBS,0); return <><div className="mb-2 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#17324D]" style={{fontFamily:'Source Serif Pro, serif'}}>Aftermarket</h2><p className="text-sm text-[#6387C2]">Salvage revenue excludes outlet sales.</p></div><div className="flex gap-2"><Button variant={period==='YTD'?'default':'outline'} onClick={()=>setPeriod('YTD')}>YTD</Button><Button variant={period==='Prior YTD'?'default':'outline'} onClick={()=>setPeriod('Prior YTD')}>Prior YTD</Button></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Pounds diverted" value={diverted==null?'—':fmtNum(diverted)} sub={diverted==null?'Validated trash tonnage unavailable':'Not sent to landfill'} accent={GOODWILL.sage}/><Kpi label="Diversion rate" value={diverted==null?'—':pct(r.DONATED_LBS?diverted/r.DONATED_LBS*100:0)} sub={diverted==null?'Validated trash tonnage unavailable':'Share of donated pounds'} accent={GOODWILL.lime}/><Kpi label="Salvage sales" value={fmtUSD(r.SALVAGE_SALES)} sub="Aftermarket only" accent={GOODWILL.blue}/><Kpi label="Outlet + salvage dollars / donor" value={fmtUSD(r.DONOR_TOTAL?(r.SALVAGE_SALES+r.OUTLET_SALES)/r.DONOR_TOTAL:0)} sub="Includes outlet sales + salvage sales" accent={GOODWILL.gold}/></div><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Diversion versus prior YTD</h3><div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3"><div className="rounded-lg bg-[#F1F7FC] p-4"><div className="text-xs text-[#6387C2]">Current diverted pounds</div><div className="mt-1 text-2xl font-semibold text-[#17324D]">{diverted==null?'—':fmtNum(diverted)}</div></div><div className="rounded-lg bg-[#F1F7FC] p-4"><div className="text-xs text-[#6387C2]">Prior diverted pounds</div><div className="mt-1 text-2xl font-semibold text-[#17324D]">{priorDiverted==null?'—':fmtNum(priorDiverted)}</div></div><div className="rounded-lg bg-[#F1F7FC] p-4"><div className="text-xs text-[#6387C2]">Change</div><div className={cnClass('mt-1 text-2xl font-semibold',diverted!=null&&priorDiverted!=null&&diverted>=priorDiverted?'text-[#4D8A5A]':'text-[#B85450]')}>{diverted==null||priorDiverted==null||!priorDiverted?'—':pct(((diverted-priorDiverted)/priorDiverted)*100)}</div></div></div></div></Card></>}}</QueryBlock><QueryBlock sourceId="aftermarket-category-sales" label="Salvage sales by category" sql={SALVAGE_CATEGORY_SQL} numericKeys={['SALES_DOLLARS']} onLoaded={markUpdated}>{rows=>{const data=rows.filter(x=>x.PERIOD_LABEL===period).sort((a,b)=>b.SALES_DOLLARS-a.SALES_DOLLARS); return <Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Salvage sales by category</h3><ChartPanel className="min-h-[420px]"><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={barOptions(`Salvage category sales — ${period}`,data.map(x=>x.CATEGORY),data.map(x=>x.SALES_DOLLARS),'Sales ($)',GOODWILL.blue)}/></ChartPanel></div></Card>}}</QueryBlock></div>;
}

function WasteTab({ markUpdated }) {
  const [period,setPeriod]=React.useState('YTD');
  return <div className="space-y-5"><QueryBlock sourceId="waste-hauling" label="Waste hauling dashboard" sql={WASTE_SQL} numericKeys={['VALUE','TONS','PICKUPS','DONORS','TRASH_LBS_PER_DONOR','TONS_PER_PULL']} onLoaded={markUpdated} skeleton="value">{rows=>{const summary=rows.find(x=>x.KIND==='SUMMARY'&&x.PERIOD_LABEL===period); const prior=rows.find(x=>x.KIND==='SUMMARY'&&x.PERIOD_LABEL!=='YTD'); const vendors=rows.filter(x=>x.KIND==='VENDOR'&&x.PERIOD_LABEL===period).sort((a,b)=>b.VALUE-a.VALUE); const locations=rows.filter(x=>x.KIND==='LOCATION'&&x.PERIOD_LABEL===period).sort((a,b)=>b.VALUE-a.VALUE); return <><div className="mb-2 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#17324D]" style={{fontFamily:'Source Serif Pro, serif'}}>Waste hauling</h2><p className="text-sm text-[#6387C2]">All identified hauling, pickup, disposal, and recycling spend. Locations use invoice site codes or billing addresses.</p></div><div className="flex gap-2"><Button variant={period==='YTD'?'default':'outline'} onClick={()=>setPeriod('YTD')}>YTD</Button><Button variant={period==='Prior YTD'?'default':'outline'} onClick={()=>setPeriod('Prior YTD')}>Prior YTD</Button></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Total waste spend" value={fmtUSD(summary?.VALUE)} sub="All hauling and disposal spend" accent={GOODWILL.blue}/><Kpi label="Waste tons" value={fmtNum(summary?.TONS,1)} sub="Billed tons" accent={GOODWILL.sage}/><Kpi label="Pickups" value={fmtNum(summary?.PICKUPS)} sub="Billed pickup quantity" accent={GOODWILL.gold}/><Kpi label="Trash pounds / donor" value={fmtNum(summary?.TRASH_LBS_PER_DONOR,1)} sub="Tons converted to pounds" accent={GOODWILL.periwinkle}/></div><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Spend versus prior YTD</h3><div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3"><div><div className="text-xs text-[#6387C2]">Current spend</div><div className="text-2xl font-semibold text-[#17324D]">{fmtUSD(summary?.VALUE)}</div></div><div><div className="text-xs text-[#6387C2]">Prior spend</div><div className="text-2xl font-semibold text-[#17324D]">{fmtUSD(prior?.VALUE)}</div></div><div><div className="text-xs text-[#6387C2]">Change</div><div className={cnClass('text-2xl font-semibold',(summary?.VALUE||0)<=(prior?.VALUE||0)?'text-[#4D8A5A]':'text-[#B85450]')}>{pct(prior?.VALUE?((summary.VALUE-prior.VALUE)/prior.VALUE)*100:0)}</div></div></div></div></Card><div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Spend by vendor / hauler</h3><ChartPanel><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={barOptions('Waste spend by vendor',vendors.map(x=>x.CATEGORY),vendors.map(x=>x.VALUE),'Spend ($)',GOODWILL.blue)}/></ChartPanel></div></Card><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Spend by billed location</h3><ChartPanel className="min-h-[420px]"><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={barOptions('Waste spend by location',locations.map(x=>x.CATEGORY),locations.map(x=>x.VALUE),'Spend ($)',GOODWILL.sage)}/></ChartPanel></div></Card></div><div className="grid grid-cols-1 gap-5 lg:grid-cols-2"><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Pickups by location</h3><ChartPanel className="min-h-[420px]"><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={barOptions('Pickups by location',locations.map(x=>x.CATEGORY),locations.map(x=>x.PICKUPS),'Pickups',GOODWILL.gold)}/></ChartPanel></div></Card><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Tons per pull / service by location</h3><p className="text-xs text-[#6387C2]">Calculated as billed tons divided by billed pickup/service quantity.</p><ChartPanel className="min-h-[420px]"><HighchartsReact highcharts={Highcharts} containerProps={{style:{width:'100%'}}} options={barOptions('Tons per pull by location',locations.map(x=>x.CATEGORY),locations.map(x=>x.TONS_PER_PULL),'Tons per pull',GOODWILL.periwinkle,'{y:,.2f}')}/></ChartPanel></div></Card></div><Card><div className="p-4"><h3 className="text-base font-semibold text-[#17324D]">Waste detail</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-[#0854A0] text-left text-white"><th className="p-2">Location</th><th className="p-2">Spend</th><th className="p-2">Tons</th><th className="p-2">Pickups</th></tr></thead><tbody>{locations.map((x,i)=><tr key={i} className={i%2===0?'bg-[#F7FAFD]':'bg-white'}><td className="p-2 text-[#17324D]">{x.CATEGORY}</td><td className="p-2">{fmtUSD(x.VALUE)}</td><td className="p-2">{fmtNum(x.TONS,1)}</td><td className="p-2">{fmtNum(x.PICKUPS)}</td></tr>)}</tbody></table></div></div></Card></>}}</QueryBlock></div>;
}

function App() {
  const [tab,setTab]=React.useState('dgr');
  const [updatedAt,setUpdatedAt]=React.useState(null);
  const markUpdated=React.useCallback(()=>setUpdatedAt(new Date()),[]);
  const logo=window.images['goodwill-logo'] || window.images['goodwill-logo.png'];
  return <div className="min-h-screen bg-[#F7FAFD] px-4 py-5 md:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><header className="mb-5 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><img src={logo} alt="Goodwill" className="h-12 w-auto"/><div><h1 className="text-2xl font-semibold text-[#17324D]" style={{fontFamily:'Source Serif Pro, serif'}}>Sustainability dashboard</h1><p className="text-sm text-[#6387C2]">Donated goods, aftermarket diversion, and waste hauling performance</p><LastUpdated at={updatedAt}/></div></div><div className="rounded-lg bg-[#F1F7FC] px-3 py-2 text-xs text-[#2C549A]">Calendar YTD · 45 lb donor assumption</div></header><TabsPrimitive.Root value={tab} onValueChange={setTab}><TabsPrimitive.List className="flex w-full flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm"><TabsPrimitive.Trigger value="dgr" className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-[#2C549A] data-[state=active]:bg-[#0854A0] data-[state=active]:text-white">DGR</TabsPrimitive.Trigger><TabsPrimitive.Trigger value="aftermarket" className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-[#2C549A] data-[state=active]:bg-[#0854A0] data-[state=active]:text-white">Aftermarket</TabsPrimitive.Trigger><TabsPrimitive.Trigger value="waste" className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-[#2C549A] data-[state=active]:bg-[#0854A0] data-[state=active]:text-white">Waste hauling</TabsPrimitive.Trigger></TabsPrimitive.List></TabsPrimitive.Root><div className="mt-5">{tab==='dgr'&&<DgrTab markUpdated={markUpdated}/>} {tab==='aftermarket'&&<AftermarketTab markUpdated={markUpdated}/>} {tab==='waste'&&<WasteTab markUpdated={markUpdated}/>}</div><footer className="flex justify-end py-8"><img src={logo} alt="Goodwill" className="h-7 w-auto opacity-70"/></footer></div></div>;
}
