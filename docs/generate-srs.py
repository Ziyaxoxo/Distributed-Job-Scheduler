#!/usr/bin/env python3
"""Generate IEEE-style SRS Word document for Distributed Job Scheduler."""

import os
from datetime import date
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

DOCS_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(DOCS_DIR, 'SRS-Distributed-Job-Scheduler.docx')
DIAGRAMS_DIR = os.path.join(DOCS_DIR, '_diagrams')
os.makedirs(DIAGRAMS_DIR, exist_ok=True)


def set_heading_style(doc):
    styles = doc.styles
    for i in range(1, 4):
        style = styles[f'Heading {i}']
        style.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        style.font.bold = True


def add_cover_page(doc):
    for _ in range(6):
        doc.add_paragraph()
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run('Software Requirements Specification\n\nDistributed Job Scheduler')
    run.bold = True
    run.font.size = Pt(24)
    run.font.color.rgb = RGBColor(0x31, 0x41, 0x55)

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = sub.add_run(f'Version 1.0\n{date.today().strftime("%B %d, %Y")}')
    r.font.size = Pt(14)
    r.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)

    doc.add_page_break()


def add_revision_table(doc):
    doc.add_heading('Document Control', level=1)
    table = doc.add_table(rows=2, cols=4)
    table.style = 'Table Grid'
    headers = ['Version', 'Date', 'Author', 'Description']
    for i, h in enumerate(headers):
        table.rows[0].cells[i].text = h
    table.rows[1].cells[0].text = '1.0'
    table.rows[1].cells[1].text = date.today().isoformat()
    table.rows[1].cells[2].text = 'Engineering Team'
    table.rows[1].cells[3].text = 'Initial release'
    doc.add_paragraph()


def generate_architecture_diagram():
    path = os.path.join(DIAGRAMS_DIR, 'architecture.png')
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 10)
    ax.axis('off')

    boxes = {
        'Dashboard': (1, 8, 2.5, 0.8, '#6366F1'),
        'API Clients': (1, 6.5, 2.5, 0.8, '#6366F1'),
        'Express API': (5, 7.5, 3, 1, '#0EA5E9'),
        'Auth Middleware': (5, 6, 3, 0.8, '#38BDF8'),
        'Job/Queue/Worker Services': (5, 4.5, 3, 1, '#38BDF8'),
        'PostgreSQL': (5, 2.5, 3, 1, '#10B981'),
        'Worker Fleet': (9.5, 5, 2, 2, '#F59E0B'),
        'Poll + SKIP LOCKED': (9.5, 3, 2, 0.8, '#FBBF24'),
    }

    for label, (x, y, w, h, color) in boxes.items():
        rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.05",
                              facecolor=color, edgecolor='#334155', linewidth=1.5, alpha=0.9)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2, label, ha='center', va='center', fontsize=8,
                fontweight='bold', color='white')

  # Arrows
    arrows = [
        ((3.5, 8.4), (5, 8)), ((3.5, 6.9), (5, 7.8)),
        ((6.5, 7.5), (6.5, 7)), ((6.5, 6), (6.5, 5.5)),
        ((6.5, 4.5), (6.5, 3.5)), ((8, 6), (9.5, 6)),
        ((10.5, 5), (10.5, 3.8)), ((10.5, 3), (8, 3)),
    ]
    for start, end in arrows:
        ax.annotate('', xy=end, xytext=start,
                    arrowprops=dict(arrowstyle='->', color='#475569', lw=1.5))

    ax.set_title('System Architecture Diagram', fontsize=14, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    return path


def generate_er_diagram():
    path = os.path.join(DIAGRAMS_DIR, 'er_diagram.png')
    fig, ax = plt.subplots(figsize=(14, 10))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis('off')

    entities = [
        ('users', 1, 8.5), ('organizations', 1, 6.5), ('projects', 4, 8.5),
        ('queues', 7, 8.5), ('retry_policies', 7, 6.5), ('jobs', 10, 8.5),
        ('job_executions', 10, 6.5), ('job_logs', 10, 4.5),
        ('workers', 4, 4.5), ('worker_heartbeats', 1, 4.5),
        ('scheduled_jobs', 7, 4.5), ('dead_letter_queue', 10, 2.5),
    ]

    for name, x, y in entities:
        rect = FancyBboxPatch((x, y), 2.5, 0.9, boxstyle="round,pad=0.03",
                              facecolor='#E0E7FF', edgecolor='#4338CA', linewidth=1.5)
        ax.add_patch(rect)
        ax.text(x + 1.25, y + 0.45, name, ha='center', va='center', fontsize=8, fontweight='bold')

    relations = [
        ((2.5, 8.9), (4, 8.9), '1:N'),
        ((3.25, 8.5), (3.25, 7.4), 'N:1'),
        ((6.5, 8.9), (7, 8.9), '1:N'),
        ((8.25, 8.5), (8.25, 7.4), 'N:1'),
        ((9.5, 8.9), (10, 8.9), '1:N'),
        ((11.25, 8.5), (11.25, 7.4), '1:N'),
        ((11.25, 6.5), (11.25, 5.4), '1:N'),
        ((5.25, 4.9), (5.25, 5.4), '1:N'),
        ((3.5, 4.9), (4, 4.9), '1:N'),
        ((11.25, 4.5), (11.25, 3.4), '0:1'),
    ]
    for start, end, card in relations:
        ax.annotate('', xy=end, xytext=start,
                    arrowprops=dict(arrowstyle='-', color='#64748B', lw=1))
        mx, my = (start[0]+end[0])/2, (start[1]+end[1])/2
        ax.text(mx, my, card, fontsize=6, color='#475569', ha='center')

    ax.set_title('Entity-Relationship Diagram', fontsize=14, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    return path


def generate_class_diagram():
    path = os.path.join(DIAGRAMS_DIR, 'class_diagram.png')
    fig, ax = plt.subplots(figsize=(14, 10))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis('off')

    classes = [
        ('User\n+id: UUID\n+email: String', 0.5, 8),
        ('Project\n+id: UUID\n+name: String', 0.5, 6),
        ('Queue\n+priority: Int\n+maxConcurrency: Int', 0.5, 4),
        ('Job\n+status: JobStatus\n+jobType: JobType', 0.5, 2),
        ('JobService\n+createJob()\n+retryJob()', 5, 8),
        ('ClaimService\n+claimNextJob()\n+completeJob()', 5, 6),
        ('RetryService\n+computeDelay()', 5, 4),
        ('WorkerPoller\n+poll()\n+execute()\n+heartbeat()', 5, 2),
        ('AuthController', 9.5, 8),
        ('JobController', 9.5, 6),
        ('QueueController', 9.5, 4),
        ('WorkerController', 9.5, 2),
    ]

    for label, x, y in classes:
        lines = label.split('\n')
        h = 0.35 + len(lines) * 0.35
        color = '#FEF3C7' if 'Controller' in label else '#DBEAFE' if 'Service' in label or 'Poller' in label else '#D1FAE5'
        rect = FancyBboxPatch((x, y), 3.5, h, boxstyle="round,pad=0.02",
                              facecolor=color, edgecolor='#334155', linewidth=1.2)
        ax.add_patch(rect)
        for i, line in enumerate(lines):
            weight = 'bold' if i == 0 else 'normal'
            ax.text(x + 0.15, y + h - 0.25 - i*0.35, line, fontsize=7, fontweight=weight)

    deps = [
        ((2, 8.5), (5, 8.5)), ((2, 6.5), (5, 6.5)), ((2, 4.5), (5, 4.5)),
        ((4, 8), (9.5, 8.2)), ((4, 6), (9.5, 6.2)), ((4, 4), (9.5, 4.2)),
        ((8.5, 6), (8.5, 4.5)), ((8.5, 4), (8.5, 2.5)),
    ]
    for start, end in deps:
        ax.annotate('', xy=end, xytext=start,
                    arrowprops=dict(arrowstyle='->', color='#64748B', lw=1, linestyle='dashed'))

    ax.set_title('UML Class Diagram (Logical Layers)', fontsize=14, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close()
    return path


def add_requirements_table(doc, title, requirements):
    doc.add_heading(title, level=2)
    table = doc.add_table(rows=1, cols=3)
    table.style = 'Table Grid'
    hdr = table.rows[0].cells
    hdr[0].text = 'ID'
    hdr[1].text = 'Requirement'
    hdr[2].text = 'Priority'
    for req_id, desc, priority in requirements:
        row = table.add_row().cells
        row[0].text = req_id
        row[1].text = desc
        row[2].text = priority
    doc.add_paragraph()


def build_document():
    arch_path = generate_architecture_diagram()
    er_path = generate_er_diagram()
    class_path = generate_class_diagram()

    doc = Document()
    set_heading_style(doc)
    add_cover_page(doc)
    add_revision_table(doc)

    # 1. Introduction
    doc.add_heading('1. Introduction', level=1)
    doc.add_heading('1.1 Purpose', level=2)
    doc.add_paragraph(
        'This Software Requirements Specification (SRS) defines the functional and non-functional '
        'requirements for the Distributed Job Scheduler — a production-inspired platform for reliably '
        'executing asynchronous background jobs across multiple worker processes.'
    )
    doc.add_heading('1.2 Scope', level=2)
    doc.add_paragraph(
        'The system provides authentication, project and queue management, job scheduling (immediate, '
        'delayed, scheduled, recurring, batch), atomic job claiming, worker fleet management, retry '
        'policies, dead letter queue handling, and a web dashboard for monitoring and administration.'
    )
    doc.add_heading('1.3 Definitions', level=2)
    defs = [
        ('Job', 'A unit of work with a JSON payload to be executed asynchronously.'),
        ('Queue', 'A named container for jobs within a project, with priority and concurrency settings.'),
        ('Worker', 'A stateless process that polls for and executes jobs.'),
        ('DLQ', 'Dead Letter Queue — storage for permanently failed jobs.'),
        ('SKIP LOCKED', 'PostgreSQL row locking mode that skips already-locked rows during concurrent claims.'),
    ]
    for term, definition in defs:
        p = doc.add_paragraph()
        p.add_run(f'{term}: ').bold = True
        p.add_run(definition)

    # 2. Overall Description
    doc.add_heading('2. Overall Description', level=1)
    doc.add_heading('2.1 Product Perspective', level=2)
    doc.add_paragraph(
        'The product is a self-hosted job scheduling platform comprising an Express REST API, '
        'PostgreSQL database, horizontally scalable worker fleet, and React dashboard. '
        'It is designed for teams needing reliable background job execution without external message broker infrastructure.'
    )
    doc.add_heading('2.2 User Classes', level=2)
    doc.add_paragraph('Developer/Operator — creates projects, queues, and jobs via API or dashboard.')
    doc.add_paragraph('System Administrator — monitors workers, queue health, and DLQ entries.')
    doc.add_heading('2.3 Constraints', level=2)
    doc.add_paragraph('PostgreSQL 16+ required for SKIP LOCKED support.')
    doc.add_paragraph('Recurring jobs use interval-based scheduling, not cron expressions.')
    doc.add_paragraph('Dashboard uses HTTP polling, not WebSockets.')

    # 3. Architecture
    doc.add_heading('3. System Architecture', level=1)
    doc.add_paragraph(
        'The architecture follows a decoupled monolithic API with distributed workers. '
        'All state is stored in PostgreSQL. Workers poll for eligible jobs, claim them atomically '
        'using row-level locking, execute concurrently, and report status back to the database.'
    )
    doc.add_picture(arch_path, width=Inches(6))
    last_paragraph = doc.paragraphs[-1]
    last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # 4. Functional Requirements
    doc.add_heading('4. Functional Requirements', level=1)
    functional = [
        ('FR-001', 'The system shall allow user registration with email and password (min 8 chars).', 'High'),
        ('FR-002', 'The system shall authenticate users via JWT tokens with 24-hour expiry.', 'High'),
        ('FR-003', 'Users shall create, read, update, and delete projects scoped to their account.', 'High'),
        ('FR-004', 'Each project shall support multiple job queues with unique names.', 'High'),
        ('FR-005', 'Queues shall be configurable with priority, max concurrency, pause/resume, and retry policy.', 'High'),
        ('FR-006', 'The system shall accept immediate, delayed, scheduled, recurring, and batch job types.', 'High'),
        ('FR-007', 'Workers shall claim jobs atomically using FOR UPDATE SKIP LOCKED.', 'High'),
        ('FR-008', 'Workers shall send heartbeats every 5 seconds.', 'High'),
        ('FR-009', 'Dead workers (no heartbeat > 30s) shall have their jobs requeued.', 'High'),
        ('FR-010', 'Failed jobs shall retry using fixed, linear, or exponential backoff.', 'High'),
        ('FR-011', 'Jobs exceeding max retries shall be moved to the Dead Letter Queue.', 'High'),
        ('FR-012', 'The system shall maintain execution logs and retry history per job.', 'High'),
        ('FR-013', 'Users shall manually retry failed/DLQ jobs via API.', 'Medium'),
        ('FR-014', 'The dashboard shall display queue health, workers, jobs, and DLQ with polling.', 'Medium'),
        ('FR-015', 'All list endpoints shall support pagination (page, limit).', 'Medium'),
    ]
    add_requirements_table(doc, '4.1 Functional Requirements', functional)

    # 5. Non-Functional Requirements
    doc.add_heading('5. Non-Functional Requirements', level=1)
    nfr = [
        ('NFR-001', 'Job claiming shall prevent duplicate execution under concurrent workers.', 'High'),
        ('NFR-002', 'API shall return structured JSON error responses with error codes.', 'High'),
        ('NFR-003', 'Passwords shall be hashed with bcrypt (cost factor 12).', 'High'),
        ('NFR-004', 'Workers shall support graceful shutdown completing in-flight jobs.', 'High'),
        ('NFR-005', 'System shall be deployable via Docker Compose in under 10 minutes.', 'Medium'),
        ('NFR-006', 'API response time for list endpoints shall be < 500ms at 10K jobs.', 'Medium'),
    ]
    add_requirements_table(doc, '5.1 Non-Functional Requirements', nfr)

    # 6. External Interfaces
    doc.add_heading('6. External Interface Requirements', level=1)
    doc.add_heading('6.1 REST API', level=2)
    api_endpoints = [
        'POST /api/auth/register', 'POST /api/auth/login',
        'GET/POST /api/projects', 'GET/PATCH/DELETE /api/projects/{id}',
        'GET/POST /api/projects/{projectId}/queues',
        'GET/PATCH/DELETE /api/queues/{id}', 'GET /api/queues/{id}/stats',
        'POST /api/queues/{queueId}/jobs',
        'GET /api/jobs', 'GET /api/jobs/{id}', 'POST /api/jobs/{id}/retry',
        'GET /api/dlq', 'GET /api/workers', 'POST /api/workers/register',
        'POST /api/workers/heartbeat', 'GET /api/stats',
    ]
    for ep in api_endpoints:
        doc.add_paragraph(ep, style='List Bullet')

    doc.add_heading('6.2 User Interface', level=2)
    ui_pages = ['Overview Dashboard', 'Projects & Queues', 'Job Explorer', 'Workers Monitor', 'DLQ Viewer']
    for page in ui_pages:
        doc.add_paragraph(page, style='List Bullet')

    # 7. Data Requirements
    doc.add_heading('7. Data Requirements', level=1)
    doc.add_paragraph(
        'The database schema is normalized to 3NF with 14 entity tables. '
        'Critical indexes support worker polling, queue statistics, and dead worker recovery.'
    )
    doc.add_picture(er_path, width=Inches(6))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_heading('7.1 Entity Descriptions', level=2)
    entities_desc = [
        ('users', 'Authenticated accounts with email and password hash.'),
        ('projects', 'Logical grouping of queues owned by a user.'),
        ('queues', 'Job containers with priority, concurrency, and pause state.'),
        ('jobs', 'Work units with payload, status, scheduling metadata.'),
        ('job_executions', 'Historical execution attempts with timing and results.'),
        ('job_logs', 'Append-only execution log entries.'),
        ('workers', 'Registered worker processes with heartbeat tracking.'),
        ('dead_letter_queue', 'Permanently failed jobs with failure reason.'),
        ('retry_policies', 'Configurable retry strategy definitions.'),
    ]
    for entity, desc in entities_desc:
        p = doc.add_paragraph()
        p.add_run(f'{entity}: ').bold = True
        p.add_run(desc)

    # 8. Design Model
    doc.add_heading('8. Design Model', level=1)
    doc.add_paragraph(
        'The logical class diagram shows entity models, service layer, controllers, and worker components.'
    )
    doc.add_picture(class_path, width=Inches(6))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER

    # 9. Appendices
    doc.add_heading('9. Appendices', level=1)
    doc.add_heading('9.1 Job Lifecycle States', level=2)
    states = 'QUEUED → SCHEDULED → CLAIMED → RUNNING → COMPLETED | FAILED → DLQ'
    doc.add_paragraph(states)

    doc.add_heading('9.2 Out of Scope', level=2)
    out_of_scope = [
        'Full cron expression parsing', 'Workflow/job dependencies',
        'Rate limiting', 'Queue sharding', 'Distributed locking beyond DB',
        'WebSocket live updates', 'RBAC', 'AI failure summaries',
    ]
    for item in out_of_scope:
        doc.add_paragraph(item, style='List Bullet')

    doc.add_heading('9.3 References', level=2)
    doc.add_paragraph('IEEE Std 29148-2018 — Systems and software engineering — Life cycle processes — Requirements engineering')
    doc.add_paragraph('PostgreSQL Documentation — SELECT FOR UPDATE SKIP LOCKED')
    doc.add_paragraph('Project Repository — architecture.md, er-diagram.md, design-decisions.md, openapi.yaml')

    doc.save(OUTPUT)
    print(f'SRS document generated: {OUTPUT}')
    return OUTPUT


if __name__ == '__main__':
    build_document()
