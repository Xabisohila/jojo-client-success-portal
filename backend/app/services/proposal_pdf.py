"""
Generates a professional proposal PDF using fpdf2.
Pure-Python, no system dependencies.
"""
import math
from datetime import date
from fpdf import FPDF


def _clean(text: str) -> str:
    """Replace Unicode chars unsupported by Helvetica (Latin-1) with ASCII equivalents."""
    if not text:
        return text or ""
    replacements = {
        "—": "--",   # em dash
        "–": "-",    # en dash
        "‘": "'",    # left single quote
        "’": "'",    # right single quote
        "“": '"',    # left double quote
        "”": '"',    # right double quote
        "…": "...",  # ellipsis
        "×": "x",    # multiplication sign
        "•": "*",    # bullet
        " ": " ",    # non-breaking space
        "·": "-",    # middle dot
        "−": "-",    # minus sign
        "―": "--",   # horizontal bar
    }
    for char, sub in replacements.items():
        text = text.replace(char, sub)
    return text.encode("latin-1", errors="replace").decode("latin-1")


BRAND = (79, 70, 229)      # indigo-600
DARK  = (17, 24, 39)       # gray-900
MID   = (55, 65, 81)       # gray-700
LIGHT = (107, 114, 128)    # gray-500
RULE  = (229, 231, 235)    # gray-200
BG    = (249, 250, 251)    # gray-50
GREEN = (22, 101, 52)      # green-800


class ProposalPDF(FPDF):
    def header(self):
        self.set_fill_color(*BRAND)
        self.rect(0, 0, self.w, 16, style="F")
        self.set_y(4)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(255, 255, 255)
        self.cell(self.l_margin + 4, 8, "  Jojo AI", new_x="RIGHT", new_y="TOP")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(200, 200, 255)
        self.cell(0, 8, "AI Receptionist Service  |  Proposal", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(*DARK)
        self.ln(6)

    def footer(self):
        self.set_y(-12)
        self.set_draw_color(*RULE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*LIGHT)
        self.cell(0, 5, f"Confidential  |  Jojo AI Proposal  |  Page {self.page_no()}", align="C")


def _section(pdf: ProposalPDF, title: str):
    pdf.set_fill_color(*BG)
    pdf.set_draw_color(*RULE)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*BRAND)
    pdf.cell(0, 7, f"  {title.upper()}", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)


def _body(pdf: ProposalPDF, text: str):
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MID)
    pdf.multi_cell(0, 5.5, _clean(text or ""))
    pdf.ln(4)


def _kv(pdf: ProposalPDF, label: str, value: str, bold_value: bool = False):
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*LIGHT)
    pdf.cell(50, 6, _clean(label))
    pdf.set_font("Helvetica", "B" if bold_value else "", 9)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 6, _clean(value), new_x="LMARGIN", new_y="NEXT")


def _money(value) -> str:
    if value is None:
        return "-"
    return f"${float(value):,.2f}"


def generate_proposal_pdf(proposal, lead, company_name: str = "Jojo AI") -> bytes:
    """
    proposal: SQLAlchemy Proposal ORM instance
    lead:     SQLAlchemy Lead ORM instance
    returns:  raw PDF bytes
    """
    tier_labels = {
        "starter": "Jojo Starter",
        "professional": "Jojo Professional",
        "enterprise": "Jojo Enterprise",
        "custom": "Custom Package",
    }
    tier = tier_labels.get(proposal.pricing_tier, proposal.pricing_tier.title())

    pdf = ProposalPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.set_margins(left=18, top=22, right=18)
    pdf.add_page()

    # ── Title ────────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*DARK)
    pdf.cell(0, 10, _clean(f"{tier} Proposal"), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*LIGHT)
    pdf.cell(0, 6, _clean(f"Version {proposal.version}  |  Valid until {proposal.valid_until or 'TBD'}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # ── Client info ───────────────────────────────────────────────────────────
    _section(pdf, "Prepared For")
    _kv(pdf, "Company", lead.company_name)
    _kv(pdf, "Contact", f"{lead.first_name} {lead.last_name}")
    _kv(pdf, "Email", lead.email)
    if lead.phone:
        _kv(pdf, "Phone", lead.phone)
    if lead.industry:
        _kv(pdf, "Industry", lead.industry)
    _kv(pdf, "Date", date.today().strftime("%d %B %Y"))
    pdf.ln(3)

    # ── Investment summary ────────────────────────────────────────────────────
    _section(pdf, "Investment Summary")
    col_w = (pdf.w - pdf.l_margin - pdf.r_margin) / 3

    pdf.set_fill_color(*BRAND)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 9)
    for label in ["Monthly Fee", "Setup Fee", f"Contract Term"]:
        pdf.cell(col_w, 8, f"  {label}", fill=True)
    pdf.ln()

    pdf.set_fill_color(240, 240, 255)
    pdf.set_text_color(*DARK)
    pdf.set_font("Helvetica", "B", 13)
    for value in [_money(proposal.monthly_fee), _money(proposal.setup_fee), f"{proposal.contract_months} months"]:
        pdf.cell(col_w, 10, f"  {value}", fill=True)
    pdf.ln()
    pdf.ln(5)

    # ── ROI ───────────────────────────────────────────────────────────────────
    if proposal.roi_monthly or proposal.roi_annual:
        _section(pdf, "Return on Investment")
        pdf.set_fill_color(240, 253, 244)
        pdf.set_text_color(*GREEN)
        pdf.set_font("Helvetica", "B", 9)
        for label in ["Est. Monthly ROI", "Est. Annual ROI", "ROI Multiple"]:
            pdf.cell(col_w, 8, f"  {label}", fill=True)
        pdf.ln()

        pdf.set_font("Helvetica", "B", 13)
        roi_multiple = ""
        if proposal.roi_monthly and proposal.monthly_fee and float(proposal.monthly_fee) > 0:
            mult = float(proposal.roi_monthly) / float(proposal.monthly_fee)
            roi_multiple = f"{mult:.1f}×"
        for value in [_money(proposal.roi_monthly), _money(proposal.roi_annual), roi_multiple or "—"]:
            pdf.cell(col_w, 10, f"  {value}", fill=True)
        pdf.ln()
        pdf.ln(3)

        if proposal.roi_rationale:
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(*LIGHT)
            pdf.multi_cell(0, 5, _clean(proposal.roi_rationale))
        pdf.ln(4)

    # ── Executive summary ─────────────────────────────────────────────────────
    if proposal.executive_summary:
        _section(pdf, "Executive Summary")
        _body(pdf, proposal.executive_summary)

    # ── Scope ─────────────────────────────────────────────────────────────────
    if proposal.scope_summary:
        _section(pdf, "Scope of Services")
        _body(pdf, proposal.scope_summary)

    # ── Line items ────────────────────────────────────────────────────────────
    if proposal.line_items:
        _section(pdf, "Pricing Breakdown")
        col_widths = [None, 22, 30, 30, 28]   # item, qty, unit, total, type
        full_w = pdf.w - pdf.l_margin - pdf.r_margin
        col_widths[0] = full_w - sum(c for c in col_widths[1:])

        headers = ["Service / Item", "Qty", "Unit Price", "Total", "Billing"]
        pdf.set_fill_color(*BRAND)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8)
        for i, h in enumerate(headers):
            align = "L" if i == 0 else "C"
            pdf.cell(col_widths[i], 7, f"  {h}" if i == 0 else h, fill=True, align=align)
        pdf.ln()

        pdf.set_font("Helvetica", "", 9)
        recurring_total = 0.0
        onetime_total = 0.0
        for j, item in enumerate(sorted(proposal.line_items, key=lambda x: x.sort_order)):
            fill = j % 2 == 0
            pdf.set_fill_color(248, 248, 255)
            pdf.set_text_color(*DARK)
            pdf.cell(col_widths[0], 7, _clean(f"  {item.item_name}"), fill=fill)
            pdf.cell(col_widths[1], 7, str(item.quantity), align="C", fill=fill)
            pdf.cell(col_widths[2], 7, _money(item.unit_price), align="C", fill=fill)
            pdf.cell(col_widths[3], 7, _money(item.total_price), align="C", fill=fill)
            billing = "Monthly" if item.is_recurring else "One-time"
            pdf.cell(col_widths[4], 7, billing, align="C", fill=fill)
            pdf.ln()
            if item.is_recurring:
                recurring_total += float(item.total_price or 0)
            else:
                onetime_total += float(item.total_price or 0)

        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fill_color(*BG)
        pdf.set_text_color(*DARK)
        pdf.cell(col_widths[0] + col_widths[1] + col_widths[2], 7, "  Monthly recurring", fill=True)
        pdf.cell(col_widths[3], 7, _money(recurring_total), align="C", fill=True)
        pdf.cell(col_widths[4], 7, "", fill=True)
        pdf.ln()
        pdf.cell(col_widths[0] + col_widths[1] + col_widths[2], 7, "  One-time total", fill=True)
        pdf.cell(col_widths[3], 7, _money(onetime_total), align="C", fill=True)
        pdf.cell(col_widths[4], 7, "", fill=True)
        pdf.ln()
        pdf.ln(5)

    # ── Terms & next steps ────────────────────────────────────────────────────
    _section(pdf, "Terms & Next Steps")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MID)
    pdf.multi_cell(0, 5.5, _clean(
        f"This proposal is valid until {proposal.valid_until or 'further notice'}. "
        f"Upon acceptance, a {proposal.contract_months}-month service agreement will be prepared for signature. "
        "The setup fee is due upon contract execution. Monthly fees commence on the Jojo go-live date.\n\n"
        "To proceed, please confirm acceptance with your Jojo account manager. "
        "We look forward to welcoming you as a Jojo client."
    ))
    pdf.ln(6)

    # ── Signature block ───────────────────────────────────────────────────────
    _section(pdf, "Acceptance")
    sig_w = (pdf.w - pdf.l_margin - pdf.r_margin - 10) / 2

    for label in ["Client Signature", "Jojo Representative"]:
        pdf.set_draw_color(*RULE)
        pdf.line(pdf.get_x(), pdf.get_y() + 12, pdf.get_x() + sig_w - 5, pdf.get_y() + 12)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*LIGHT)
        col_x = pdf.get_x()
        pdf.set_xy(col_x, pdf.get_y() + 14)
        pdf.cell(sig_w, 5, label)
        pdf.set_xy(col_x + sig_w + 5, pdf.get_y() - 14)

    return bytes(pdf.output())
