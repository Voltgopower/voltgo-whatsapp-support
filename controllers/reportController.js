const ExcelJS = require("exceljs");
const portalRepository = require("../repositories/portalRepository");

function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatMoney(value) {
  return Number(value || 0);
}

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);

  sheet.columns = columns;

  sheet.getRow(1).font = { bold: true };

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  sheet.columns.forEach((column) => {
    column.width = Math.max(column.header.length + 2, 18);
  });

  return sheet;
}

async function getSalesReport(req, res) {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        message: "start_date and end_date are required",
      });
    }

    const report = await portalRepository.getSalesReport({
      start_date,
      end_date,
    });

    res.json(report);
  } catch (err) {
    console.error("Get sales report failed:", err);

    res.status(500).json({
      message: "Failed to generate report",
    });
  }
}

async function exportSalesReport(req, res) {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        message: "start_date and end_date are required",
      });
    }

    const report = await portalRepository.getSalesReport({
      start_date,
      end_date,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "VisionCore Portal";
    workbook.created = new Date();

    addSheet(
      workbook,
      "Summary",
      [
        { header: "Item", key: "item" },
        { header: "Value", key: "value" },
      ],
      [
        {
          item: "Report Period",
          value: `${start_date} to ${end_date}`,
        },
        {
          item: "Generated At",
          value: new Date().toISOString(),
        },
        {
          item: "Currency",
          value: "USD",
        },
        {
          item: "Total Invoice",
          value: formatMoney(report.summary?.total_invoice),
        },
        {
          item: "Total Received",
          value: formatMoney(report.summary?.total_received),
        },
        {
          item: "Total Outstanding",
          value: formatMoney(report.summary?.total_outstanding),
        },
        {
          item: "Batch Count",
          value: Number(report.summary?.batch_count || 0),
        },
        {
          item: "Customer Count",
          value: Number(report.summary?.customer_count || 0),
        },
      ]
    );

    addSheet(
      workbook,
      "Sales by SKU",
      [
        { header: "SKU", key: "sku" },
        { header: "Description", key: "description" },
        { header: "Qty", key: "qty" },
        { header: "Sales Amount", key: "sales_amount" },
      ],
      report.sales_by_sku.map((item) => ({
        sku: item.sku || "",
        description: item.description || "",
        qty: Number(item.total_qty || 0),
        sales_amount: formatMoney(item.sales_amount),
      }))
    );

    addSheet(
      workbook,
      "Sales by Customer",
      [
        { header: "Customer", key: "customer" },
        { header: "Company", key: "company" },
        { header: "Invoice Amount", key: "invoice_amount" },
        { header: "Received Amount", key: "received_amount" },
        { header: "Outstanding Amount", key: "outstanding_amount" },
      ],
      report.sales_by_customer.map((item) => ({
        customer: item.customer_name || "",
        company: item.customer_company || "",
        invoice_amount: formatMoney(item.invoice_amount),
        received_amount: formatMoney(item.received_amount),
        outstanding_amount: formatMoney(item.outstanding_amount),
      }))
    );

    addSheet(
      workbook,
      "Batch Details",
      [
        { header: "Batch No", key: "batch_no" },
        { header: "Customer", key: "customer" },
        { header: "Company", key: "company" },
        { header: "Shipment Date", key: "shipment_date" },
        { header: "Invoice Amount", key: "invoice_amount" },
        { header: "Received Amount", key: "received_amount" },
        { header: "Balance", key: "balance" },
        { header: "Status", key: "status" },
      ],
      report.batch_details.map((item) => ({
        batch_no: item.batch_no || "",
        customer: item.customer_name || "",
        company: item.customer_company || "",
        shipment_date: formatDate(item.shipment_date),
        invoice_amount: formatMoney(item.invoice_amount),
        received_amount: formatMoney(item.received_amount),
        balance: formatMoney(item.balance),
        status: item.status || "",
      }))
    );

    addSheet(
      workbook,
      "Shipment Details",
      [
        { header: "Shipment No", key: "shipment_no" },
        { header: "Batch No", key: "batch_no" },
        { header: "Customer", key: "customer" },
        { header: "Carrier", key: "carrier" },
        { header: "Tracking No", key: "tracking_no" },
        { header: "Status", key: "status" },
        { header: "ETD", key: "etd" },
        { header: "ETA", key: "eta" },
        { header: "Delivered At", key: "delivered_at" },
      ],
      report.shipment_details.map((item) => ({
        shipment_no: item.shipment_no || "",
        batch_no: item.batch_no || "",
        customer: item.customer_name || "",
        carrier: item.carrier || "",
        tracking_no: item.tracking_no || "",
        status: item.status || "",
        etd: formatDate(item.etd),
        eta: formatDate(item.eta),
        delivered_at: formatDate(item.delivered_at),
      }))
    );

    addSheet(
      workbook,
      "Payment Details",
      [
        { header: "Payment Date", key: "payment_date" },
        { header: "Method", key: "method" },
        { header: "Reference No", key: "reference_no" },
        { header: "Payment Amount", key: "payment_amount" },
        { header: "Allocated Amount", key: "allocated_amount" },
        { header: "Batch No", key: "batch_no" },
        { header: "Customer", key: "customer" },
      ],
      report.payment_details.map((item) => ({
        payment_date: formatDate(item.payment_date),
        method: item.method || "",
        reference_no: item.reference_no || "",
        payment_amount: formatMoney(item.payment_amount),
        allocated_amount: formatMoney(item.allocated_amount),
        batch_no: item.batch_no || "",
        customer: item.customer_name || "",
      }))
    );

    const fileName = `Sales_Report_${start_date}_to_${end_date}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export sales report failed:", err);

    res.status(500).json({
      message: "Failed to export sales report",
    });
  }
}
async function exportCustomerStatement(req, res) {
  try {
    const { customer_id, start_date, end_date } = req.query;

    if (!customer_id || !start_date || !end_date) {
      return res.status(400).json({
        message: "customer_id, start_date and end_date are required",
      });
    }

    const statement = await portalRepository.getCustomerStatement({
      customer_id,
      start_date,
      end_date,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "VisionCore Portal";
    workbook.created = new Date();

    const summary = statement.summary || {};
    const customerName =
      summary.customer_company || summary.customer_name || `Customer_${customer_id}`;

    addSheet(
      workbook,
      "Statement Summary",
      [
        { header: "Item", key: "item" },
        { header: "Value", key: "value" },
      ],
      [
        { item: "Customer", value: summary.customer_name || "" },
        { item: "Company", value: summary.customer_company || "" },
        { item: "Statement Period", value: `${start_date} to ${end_date}` },
        { item: "Generated At", value: new Date().toISOString() },
        { item: "Currency", value: "USD" },
        { item: "Invoice Amount", value: formatMoney(summary.invoice_amount) },
        { item: "Received Amount", value: formatMoney(summary.received_amount) },
        {
          item: "Outstanding Amount",
          value: formatMoney(summary.outstanding_amount),
        },
        { item: "Batch Count", value: Number(summary.batch_count || 0) },
        {
          item: "Allocation Count",
          value: Number(summary.allocation_count || 0),
        },
      ]
    );

    addSheet(
      workbook,
      "Allocation Detail",
      [
        { header: "Allocation ID", key: "allocation_id" },
        { header: "Batch No", key: "batch_no" },
        { header: "Shipment Date", key: "shipment_date" },
        { header: "Invoice Amount", key: "invoice_amount" },
        { header: "Payment Date", key: "payment_date" },
        { header: "Method", key: "method" },
        { header: "Reference No", key: "reference_no" },
        { header: "Payment Amount", key: "payment_amount" },
        { header: "Allocated Amount", key: "allocated_amount" },
        { header: "Batch Balance", key: "batch_balance" },
        { header: "Batch Status", key: "batch_status" },
      ],
      statement.allocation_details.map((item) => ({
        allocation_id: item.allocation_id,
        batch_no: item.batch_no || "",
        shipment_date: formatDate(item.shipment_date),
        invoice_amount: formatMoney(item.invoice_amount),
        payment_date: formatDate(item.payment_date),
        method: item.method || "",
        reference_no: item.reference_no || "",
        payment_amount: formatMoney(item.payment_amount),
        allocated_amount: formatMoney(item.allocated_amount),
        batch_balance: formatMoney(item.batch_balance),
        batch_status: item.batch_status || "",
      }))
    );

    addSheet(
      workbook,
      "Batch Detail",
      [
        { header: "Batch No", key: "batch_no" },
        { header: "Shipment Date", key: "shipment_date" },
        { header: "Invoice Amount", key: "invoice_amount" },
        { header: "Received Amount", key: "received_amount" },
        { header: "Balance", key: "balance" },
        { header: "Status", key: "status" },
      ],
      statement.batch_details.map((item) => ({
        batch_no: item.batch_no || "",
        shipment_date: formatDate(item.shipment_date),
        invoice_amount: formatMoney(item.invoice_amount),
        received_amount: formatMoney(item.received_amount),
        balance: formatMoney(item.balance),
        status: item.status || "",
      }))
    );

    addSheet(
      workbook,
      "Shipment Detail",
      [
        { header: "Shipment No", key: "shipment_no" },
        { header: "Batch No", key: "batch_no" },
        { header: "Carrier", key: "carrier" },
        { header: "Tracking No", key: "tracking_no" },
        { header: "Status", key: "status" },
        { header: "ETD", key: "etd" },
        { header: "ETA", key: "eta" },
        { header: "Delivered At", key: "delivered_at" },
      ],
      statement.shipment_details.map((item) => ({
        shipment_no: item.shipment_no || "",
        batch_no: item.batch_no || "",
        carrier: item.carrier || "",
        tracking_no: item.tracking_no || "",
        status: item.status || "",
        etd: formatDate(item.etd),
        eta: formatDate(item.eta),
        delivered_at: formatDate(item.delivered_at),
      }))
    );

    addSheet(
      workbook,
      "Payment Detail",
      [
        { header: "Payment Date", key: "payment_date" },
        { header: "Method", key: "method" },
        { header: "Reference No", key: "reference_no" },
        { header: "Amount", key: "amount" },
        { header: "Notes", key: "notes" },
      ],
      statement.payment_details.map((item) => ({
        payment_date: formatDate(item.payment_date),
        method: item.method || "",
        reference_no: item.reference_no || "",
        amount: formatMoney(item.amount),
        notes: item.notes || "",
      }))
    );

    const safeCustomerName = String(customerName)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40);

    const fileName = `Statement_${safeCustomerName}_${start_date}_to_${end_date}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export customer statement failed:", err);

    res.status(500).json({
      message: "Failed to export customer statement",
    });
  }
}

module.exports = {
  getSalesReport,
  exportSalesReport,
  exportCustomerStatement,
};