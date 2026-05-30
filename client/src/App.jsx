import { useEffect, useMemo, useState } from 'react';
import { useLocation, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import {
  approveAndSendEmail,
  bulkApproveEmails,
  bulkSendEmails,
  createDonation,
  getDashboardSummary,
  generateDraft,
  getDraftById,
  getDrafts,
  getDonations,
  getDonors,
  rejectEmailDraft,
  saveEmailDraft,
} from './lib/api';
import { draftPreview, reviewQueue } from './mock';

const DEFAULT_DRAFT_MODEL = 'openai/gpt-4.1';

const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'create', label: 'Create Test Donation', icon: 'add_circle' },
  { id: 'records', label: 'Donation Records', icon: 'receipt_long' },
  { id: 'reviews', label: 'Draft Review Queue', icon: 'rate_review' },
  { id: 'draft', label: 'Draft Review', icon: 'edit_document' },
];

const initialForm = {
  donation_id: '',
  donor_name: '',
  donor_email: '',
  amount: '',
  donation_date: new Date().toISOString().slice(0, 10),
  currency: 'USD',
  campaign: 'Annual Fund',
  designation: 'Unrestricted',
  recurring_status: 'one_time',
  source: 'synthetic',
};

const defaultRecordsQuery = {
  search: '',
  status: '',
  page: 1,
  limit: 20,
};

const demoDonations = reviewQueue.map((item, index) => {
  const amount = Number(String(item.amount || '').replace(/[$,]/g, '')) || 0;
  const donorEmail = `${item.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;

  return {
    id: item.id,
    donation_id: `DON-${String(index + 1001)}`,
    donor_name: item.name,
    donor_email: donorEmail,
    amount,
    donation_date: new Date(Date.UTC(2024, index, 12 + index)).toISOString(),
    campaign: item.campaign,
    designation: item.campaign,
    acknowledgment_status: item.status === 'ready' ? 'approved' : item.status === 'review' ? 'processing' : 'failed',
    donor: {
      full_name: item.name,
      email: donorEmail,
    },
  };
});

const demoDrafts = reviewQueue.map((item, index) => {
  const donation = demoDonations[index];

  return {
    id: `${item.id}-draft`,
    donation_id: donation.donation_id,
    donor_name: item.name,
    donor_email: donation.donor_email,
    review_status: item.status === 'flagged' ? 'pending_review' : 'approved',
    email_status: item.status === 'ready' ? 'sent' : 'draft_created',
    match_status: item.status === 'flagged' ? 'uncertain' : 'matched',
    donation,
    donor: donation.donor,
    draft_subject: `Thank you, ${item.name}`,
    draft_body: draftPreview.body,
    edited_body: draftPreview.body,
    reasoning: draftPreview.reasoning.summary,
    review_notes: draftPreview.reasoning.summary,
  };
});

const demoDraftRecord = {
  ...demoDrafts[0],
  id: 'demo-draft',
  donation: {
    ...demoDonations[0],
    amount: Number(String(draftPreview.donation.amount).replace(/[$,]/g, '')) || demoDonations[0]?.amount || 0,
    donation_date: new Date(draftPreview.donation.date).toISOString(),
    designation: draftPreview.donation.designation,
  },
  donor: {
    full_name: draftPreview.donor.name,
    email: 'amelia.sterling@example.com',
  },
  draft_subject: draftPreview.subject,
  draft_body: draftPreview.body,
  edited_body: draftPreview.body,
  reasoning: draftPreview.reasoning.summary,
  review_notes: draftPreview.reasoning.summary,
};

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftRouteMatch = useMatch('/drafts/:draftId');
  const draftNewMatch = useMatch('/drafts/new');
  const [dashboard, setDashboard] = useState({
    donorsTotal: 0,
    donationsTotal: 0,
    amountTotal: 0,
    recentDonations: [],
    loading: true,
    error: '',
  });
  const [recordsQuery, setRecordsQuery] = useState(defaultRecordsQuery);
  const [recordsState, setRecordsState] = useState({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0 },
    loading: true,
    error: '',
  });
  const [form, setForm] = useState(initialForm);
  const [submission, setSubmission] = useState({ state: 'idle', message: '' });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftsQuery, setDraftsQuery] = useState({
    search: '',
    review_status: '',
    email_status: '',
    match_status: '',
    page: 1,
    limit: 20,
  });
  const [draftsState, setDraftsState] = useState({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0 },
    loading: true,
    error: '',
  });
  const [draftDetailState, setDraftDetailState] = useState({
    record: null,
    loading: false,
    error: '',
    saving: false,
    generating: false,
  });
  const [draftForm, setDraftForm] = useState({
    donationId: searchParams.get('donationId') || '',
    model: DEFAULT_DRAFT_MODEL,
  });
  const [draftNotice, setDraftNotice] = useState({ type: '', message: '' });
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [bulkSummary, setBulkSummary] = useState({ approval: null, send: null });

  const draftId = draftRouteMatch?.params?.draftId || '';
  const isDraftNewRoute = Boolean(draftNewMatch) || draftId === 'new';
  const activeRoute = isDraftNewRoute ? 'draft-new' : draftId ? 'draft-detail' : activePage;

  const pageTitle = useMemo(() => {
    switch (activeRoute) {
      case 'create':
        return 'Create Test Donation';
      case 'records':
        return 'Donation Records';
      case 'reviews':
        return 'Draft Review Queue';
      case 'draft-new':
        return 'Generate Draft';
      case 'draft-detail':
        return 'Draft Review';
      default:
        return 'Dashboard';
    }
  }, [activeRoute]);

  useEffect(() => {
    const path = location.pathname;

    if (path.startsWith('/create')) {
      setActivePage('create');
      return;
    }

    if (path.startsWith('/records')) {
      setActivePage('records');
      return;
    }

    if (path.startsWith('/reviews')) {
      setActivePage('reviews');
      return;
    }

    if (path.startsWith('/drafts')) {
      setActivePage('draft');
      return;
    }

    setActivePage('dashboard');
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setDashboard((current) => ({ ...current, loading: true, error: '' }));

        const response = await getDashboardSummary();

        if (!cancelled) {
          setDashboard({
            donorsTotal: response?.data?.donorsTotal || 0,
            donationsTotal: response?.data?.donationsTotal || 0,
            amountTotal: Number(response?.data?.amountTotal || 0),
            recentDonations: response?.data?.recentDonations || [],
            loading: false,
            error: '',
          });
        }
      } catch (error) {
        if (!cancelled) {
          setDashboard((current) => ({
            ...current,
            loading: false,
            error: '',
            donorsTotal: reviewQueue.length * 3,
            donationsTotal: demoDonations.length,
            amountTotal: demoDonations.reduce((sum, row) => sum + Number(row.amount || 0), 0),
            recentDonations: demoDonations.slice(0, 5),
          }));
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRecords() {
      try {
        setRecordsState((current) => ({ ...current, loading: true, error: '' }));

        const response = await getDonations({
          search: recordsQuery.search,
          status: recordsQuery.status,
          page: recordsQuery.page,
          limit: recordsQuery.limit,
        });

        if (!cancelled) {
          setRecordsState({
            rows: response?.data || [],
            pagination: response?.pagination || { page: 1, limit: 20, total: 0 },
            loading: false,
            error: '',
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRecordsState((current) => ({
            ...current,
            loading: false,
            error: '',
            rows: demoDonations,
            pagination: {
              page: 1,
              limit: recordsQuery.limit,
              total: demoDonations.length,
            },
          }));
        }
      }
    }

    if (activePage === 'records') {
      loadRecords();
    }

    return () => {
      cancelled = true;
    };
  }, [activePage, recordsQuery]);

  useEffect(() => {
    if (isDraftNewRoute) {
      const donationId = searchParams.get('donationId') || '';
      setDraftForm((current) => ({
        ...current,
        donationId,
      }));
    }
  }, [isDraftNewRoute, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadDrafts() {
      try {
        setDraftsState((current) => ({ ...current, loading: true, error: '' }));

        const response = await getDrafts(draftsQuery);

        if (!cancelled) {
          setDraftsState({
            rows: response?.data || [],
            pagination: response?.pagination || { page: 1, limit: 20, total: 0 },
            loading: false,
            error: '',
          });
        }
      } catch (error) {
        if (!cancelled) {
          setDraftsState((current) => ({
            ...current,
            loading: false,
            error: '',
            rows: demoDrafts,
            pagination: {
              page: 1,
              limit: draftsQuery.limit,
              total: demoDrafts.length,
            },
          }));
        }
      }
    }

    if (activePage === 'reviews') {
      loadDrafts();
    }

    return () => {
      cancelled = true;
    };
  }, [activePage, draftsQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadDraftDetail() {
      if (!draftId) {
        setDraftDetailState((current) => ({
          ...current,
          record: null,
          loading: false,
          error: '',
          saving: false,
          generating: false,
        }));
        return;
      }

      try {
        setDraftDetailState((current) => ({ ...current, loading: true, error: '' }));

        const response = await getDraftById(draftId);

        if (!cancelled) {
          const record = response?.data || null;
          setDraftDetailState({
            record,
            loading: false,
            error: '',
            saving: false,
            generating: false,
          });
          setDraftSubject(record?.draft_subject || '');
          setDraftBody(record?.edited_body || record?.draft_body || '');
        }
      } catch (error) {
        if (!cancelled) {
          setDraftDetailState((current) => ({
            ...current,
            loading: false,
            error: '',
            record: demoDraftRecord,
            saving: false,
            generating: false,
          }));
          setDraftSubject(demoDraftRecord.draft_subject || '');
          setDraftBody(demoDraftRecord.edited_body || demoDraftRecord.draft_body || '');
        }
      }
    }

    if (activePage === 'draft' && draftId && !isDraftNewRoute) {
      loadDraftDetail();
    }

    if (activePage === 'draft' && isDraftNewRoute) {
      setDraftDetailState((current) => ({
        ...current,
        record: null,
        loading: false,
        error: '',
      }));
      setDraftSubject('');
      setDraftBody('');
      setDraftNotice({ type: '', message: '' });
    }

    return () => {
      cancelled = true;
    };
  }, [activePage, draftId, isDraftNewRoute]);

  useEffect(() => {
    if (draftDetailState.record) {
      setDraftSubject(draftDetailState.record.draft_subject || '');
      setDraftBody(draftDetailState.record.edited_body || draftDetailState.record.draft_body || '');
    }
  }, [draftDetailState.record]);

  const recentDonationCount = dashboard.donationsTotal;

  const handleCreateChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const fillSample = () => {
    setForm({
      donation_id: `TST-${Math.floor(Math.random() * 9000 + 1000)}`,
      donor_name: 'Eleanor Vance',
      donor_email: 'eleanor.v@example.com',
      amount: '5000',
      donation_date: new Date().toISOString().slice(0, 10),
      currency: 'USD',
      campaign: 'Clean Water Initiative',
      designation: 'Water Projects',
      recurring_status: 'one_time',
      source: 'synthetic',
    });
    setSubmission({ state: 'idle', message: '' });
  };

  const submitDonation = async (event) => {
    event.preventDefault();

    try {
      setSubmission({ state: 'saving', message: '' });

      const payload = {
        donation_id: form.donation_id.trim(),
        donor_name: form.donor_name.trim(),
        donor_email: form.donor_email.trim(),
        amount: Number(form.amount),
        donation_date: form.donation_date,
        currency: form.currency.trim() || 'USD',
        campaign: form.campaign.trim(),
        designation: form.designation.trim(),
        recurring_status: form.recurring_status,
        source: form.source.trim() || 'synthetic',
      };

      await createDonation(payload);
      setSubmission({ state: 'success', message: 'Synthetic donation saved successfully.' });
      navigate('/records');
      setRecordsQuery((current) => ({ ...current, page: 1 }));
      setForm(initialForm);
    } catch (error) {
      setSubmission({ state: 'error', message: error.message || 'Failed to create donation.' });
    }
  };

  const updateRecordsQuery = (next) => {
    setRecordsQuery((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  };

  const goToPath = (path) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const openDraftGenerator = (donationId = '') => {
    const suffix = donationId ? `?donationId=${encodeURIComponent(donationId)}` : '';
    navigate(`/drafts/new${suffix}`);
  };

  const openDraftDetail = (draftIdValue) => {
    if (!draftIdValue) {
      return;
    }

    setDraftNotice({ type: '', message: '' });
    navigate(`/drafts/${draftIdValue}`);
  };

  const setDraftRecord = (record) => {
    setDraftDetailState({
      record,
      loading: false,
      error: '',
      saving: false,
      generating: false,
    });

    setDraftSubject(record?.draft_subject || '');
    setDraftBody(record?.edited_body || record?.draft_body || '');
    setDraftNotice({ type: 'success', message: 'Draft loaded successfully.' });
  };

  const generateDraftForDonation = async (overrideDonationId) => {
    const donationId = (overrideDonationId || draftForm.donationId || '').trim();

    if (!donationId) {
      setDraftNotice({ type: 'error', message: 'Enter a donation ID to generate a draft.' });
      return null;
    }

    try {
      setDraftDetailState((current) => ({ ...current, generating: true, error: '' }));
      setDraftNotice({ type: '', message: '' });

      const response = await generateDraft({
        donation_id: donationId,
        model: DEFAULT_DRAFT_MODEL,
      });

      const record = response?.data?.draft;

      if (!record?.id) {
        throw new Error('Draft generation returned no draft');
      }

      setDraftForm((current) => ({ ...current, donationId }));
      setDraftRecord(record);
      navigate(`/drafts/${record.id}`);

      return record;
    } catch (error) {
      setDraftDetailState((current) => ({
        ...current,
        generating: false,
        error: error.message || 'Unable to generate draft',
      }));
      setDraftNotice({ type: 'error', message: error.message || 'Unable to generate draft.' });
      return null;
    }
  };

  const saveDraft = async () => {
    const draftIdValue = draftDetailState.record?.id;

    if (!draftIdValue) {
      setDraftNotice({ type: 'error', message: 'Generate or open a draft before saving.' });
      return;
    }

    try {
      setDraftDetailState((current) => ({ ...current, saving: true, error: '' }));

      const response = await saveEmailDraft(draftIdValue, {
        draft_subject: draftSubject,
        edited_body: draftBody,
      });

      setDraftRecord(response?.data?.draft || draftDetailState.record);
      setDraftNotice({ type: 'success', message: response?.message || 'Draft saved successfully.' });
    } catch (error) {
      setDraftDetailState((current) => ({
        ...current,
        saving: false,
        error: error.message || 'Unable to save draft',
      }));
      setDraftNotice({ type: 'error', message: error.message || 'Unable to save draft.' });
    }
  };

  const approveDraft = async () => {
    const draftIdValue = draftDetailState.record?.id;

    if (!draftIdValue) {
      setDraftNotice({ type: 'error', message: 'Generate or open a draft before approving.' });
      return;
    }

    try {
      setDraftDetailState((current) => ({ ...current, saving: true, error: '' }));

      const response = await approveAndSendEmail(draftIdValue, {
        approved_by: 'frontend-reviewer',
      });

      setDraftRecord(response?.data?.draft || draftDetailState.record);
      setDraftNotice({ type: 'success', message: response?.message || 'Email workflow completed.' });
    } catch (error) {
      setDraftDetailState((current) => ({
        ...current,
        saving: false,
        error: error.message || 'Unable to approve draft',
      }));
      setDraftNotice({ type: 'error', message: error.message || 'Unable to approve draft.' });
    }
  };

  const rejectDraft = async () => {
    const draftIdValue = draftDetailState.record?.id;

    if (!draftIdValue) {
      setDraftNotice({ type: 'error', message: 'Generate or open a draft before rejecting.' });
      return;
    }

    try {
      setDraftDetailState((current) => ({ ...current, saving: true, error: '' }));

      const response = await rejectEmailDraft(draftIdValue);

      setDraftRecord(response?.data?.draft || draftDetailState.record);
      setDraftNotice({ type: 'success', message: response?.message || 'Draft rejected.' });
    } catch (error) {
      setDraftDetailState((current) => ({
        ...current,
        saving: false,
        error: error.message || 'Unable to reject draft',
      }));
      setDraftNotice({ type: 'error', message: error.message || 'Unable to reject draft.' });
    }
  };

  const rewriteDraft = async () => {
    const donationId = draftDetailState.record?.donation?.donation_id || draftDetailState.record?.donation_id || draftForm.donationId;

    if (!donationId) {
      setDraftNotice({ type: 'error', message: 'No donation available to rewrite.' });
      return;
    }

    navigate(`/drafts/new?donationId=${encodeURIComponent(donationId)}`);
  };

  const batchApproveDrafts = async () => {
    try {
      setDraftsState((current) => ({ ...current, loading: true, error: '' }));

      const response = await bulkApproveEmails({
        approved_by: 'frontend-batch',
      });

      const summary = response?.data?.summary || { total: 0, successCount: 0, failureCount: 0 };
      setBulkSummary((current) => ({ ...current, approval: summary }));
      setDraftNotice({
        type: summary.failureCount > 0 ? 'error' : 'success',
        message: response?.message || 'Batch approval completed.',
      });
      setDraftsQuery((current) => ({ ...current }));
    } catch (error) {
      setDraftNotice({ type: 'error', message: error.message || 'Unable to batch approve drafts.' });
    }
  };

  const batchSendDrafts = async () => {
    try {
      setDraftsState((current) => ({ ...current, loading: true, error: '' }));

      const response = await bulkSendEmails({
        approved_by: 'frontend-batch',
      });

      const summary = response?.data?.summary || { total: 0, successCount: 0, failureCount: 0 };
      setBulkSummary((current) => ({ ...current, send: summary }));
      const hadFailures = Number(summary.failureCount || 0) > 0;

      setDraftNotice({
        type: hadFailures ? 'error' : 'success',
        message: response?.message || 'Batch send completed.',
      });
      setDraftsQuery((current) => ({ ...current }));
    } catch (error) {
      setDraftNotice({ type: 'error', message: error.message || 'Unable to batch send drafts.' });
    }
  };

  const resetDraftFilters = () => {
    setDraftsQuery({
      search: '',
      review_status: '',
      email_status: '',
      match_status: '',
      page: 1,
      limit: 20,
    });
  };

  return (
    <div className="min-h-screen bg-background text-text-main">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[-8%] h-[40rem] w-[40rem] rounded-full bg-mint/4 blur-[180px]" />
        <div className="absolute bottom-[-10%] right-[-8%] h-[36rem] w-[36rem] rounded-full bg-sky/4 blur-[200px]" />
        <div className="absolute top-1/3 right-1/4 h-64 w-64 rounded-full bg-amber/[0.03] blur-[140px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-sidebar flex-col overflow-hidden rounded-[1.75rem] border border-transparent bg-surface/88 px-4 py-4 shadow-[0_10px_28px_rgba(0,0,0,0.14)] backdrop-blur-2xl md:flex">
          <div className="mb-5 flex items-center gap-3 px-1">
            <div className="glass-icon h-11 w-11 text-mint">
              <span className="material-symbols-outlined text-[22px]">volunteer_activism</span>
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-text-main">OpenPaws Care Desk</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mint/90">
                Stewardship Workspace
              </div>
            </div>
          </div>

          <button type="button" onClick={() => goToPath('/create')} className="glass-action mb-4 px-4 py-2.5 text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Campaign
          </button>

          <nav className="flex-1 space-y-1 overflow-hidden">
            {pages.map((item) => {
              const active = activePage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goToPath(item.id === 'dashboard' ? '/' : `/${item.id}`)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left transition ${
                    active
                      ? 'border border-mint/20 bg-white/[0.045] text-mint'
                      : 'text-text-soft hover:bg-white/[0.035] hover:text-text-main'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto space-y-1 pt-3">
            <button type="button" onClick={() => goToPath('/reviews')} className="glass-action w-full justify-start px-4 py-2.5 text-left text-text-soft">
              <span className="material-symbols-outlined text-[20px]">help_outline</span>
              <span className="text-sm font-medium">Support</span>
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-4 z-20 mx-4 rounded-[1.75rem] border border-transparent bg-surface/88 shadow-[0_10px_28px_rgba(0,0,0,0.14)] backdrop-blur-2xl md:mx-5 md:mt-4">
            <div className="flex items-center justify-between gap-4 px-5 py-4 md:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen((open) => !open)}
                  className="rounded-2xl border border-line bg-white/5 p-2 text-text-main md:hidden"
                >
                  <span className="material-symbols-outlined text-[20px]">menu</span>
                </button>
                <div>
                  <div className="text-2xl font-semibold tracking-tight text-text-main md:text-[1.75rem]">
                    {pageTitle}
                  </div>
                  <div className="mt-1 text-sm text-text-soft">Stewardship Workspace.</div>
                </div>
              </div>

              <div className="hidden items-center gap-3 md:flex">
                <button type="button" onClick={() => goToPath('/reviews')} className="glass-icon p-2 text-text-soft">
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                </button>
              </div>
            </div>

            {drawerOpen ? (
              <div className="bg-surface/95 px-4 py-3 md:hidden">
                <div className="grid gap-2">
                  {pages.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goToPath(item.id === 'dashboard' ? '/' : `/${item.id}`)}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left ${
                        activePage === item.id
                          ? 'border border-mint/20 bg-white/[0.045] text-mint'
                          : 'bg-white/[0.025] text-text-soft'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </header>

          <div className="flex-1 overflow-y-auto p-5 pt-6 md:px-8 md:pb-8 md:pt-6">
            {activePage === 'dashboard' ? (
              <DashboardView
                dashboard={dashboard}
                recentDonationCount={recentDonationCount}
                onViewAllRecords={() => goToPath('/records')}
              />
            ) : null}

            {activePage === 'create' ? (
              <CreateDonationView
                form={form}
                onChange={handleCreateChange}
                onFillSample={fillSample}
                onSubmit={submitDonation}
                submission={submission}
              />
            ) : null}

            {activePage === 'records' ? (
              <RecordsView
                query={recordsQuery}
                onQueryChange={updateRecordsQuery}
                state={recordsState}
                onGenerateDraft={openDraftGenerator}
              />
            ) : null}

            {activePage === 'reviews' ? (
              <ReviewQueueView
                query={draftsQuery}
                state={draftsState}
                onQueryChange={setDraftsQuery}
                onOpenDraft={openDraftDetail}
                onGenerateDraft={generateDraftForDonation}
                onBatchApprove={batchApproveDrafts}
                onBatchSend={batchSendDrafts}
                onResetFilters={resetDraftFilters}
                bulkSummary={bulkSummary}
              />
            ) : null}

            {activePage === 'draft' ? (
              <DraftReviewView
                mode={draftNewMatch ? 'new' : 'detail'}
                draftForm={draftForm}
                setDraftForm={setDraftForm}
                draftDetailState={draftDetailState}
                draftNotice={draftNotice}
                draftSubject={draftSubject}
                setDraftSubject={setDraftSubject}
                draftBody={draftBody}
                setDraftBody={setDraftBody}
                onGenerateDraft={generateDraftForDonation}
                onSaveDraft={saveDraft}
                onApproveDraft={approveDraft}
                onRejectDraft={rejectDraft}
                onRewriteDraft={rewriteDraft}
                onOpenReviews={() => goToPath('/reviews')}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardView({ dashboard, recentDonationCount, onViewAllRecords }) {
  const stats = [
    {
      label: 'Donors synced',
      value: dashboard.donorsTotal,
      hint: 'Live from Supabase',
      icon: 'person_search',
      tint: 'mint',
    },
    {
      label: 'Donations synced',
      value: dashboard.donationsTotal,
      hint: `${recentDonationCount} records indexed`,
      icon: 'payments',
      tint: 'sky',
    },
    {
      label: 'Captured amount',
      value: formatCurrency(dashboard.amountTotal),
      hint: 'Synthetic transactions only',
      icon: 'stacked_line_chart',
      tint: 'amber',
    },
  ];

  const tintStyles = {
    mint: 'border-mint/20 bg-mint/10 text-mint',
    sky: 'border-sky/20 bg-sky/10 text-sky',
    amber: 'border-amber/20 bg-amber/10 text-amber',
    rose: 'border-rose/20 bg-rose/10 text-rose',
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <GlassCard className="overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-soft">
              Stewardship workspace
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-text-main md:text-[2.7rem]">
              A cleaner command surface for donation review.
            </h2>
            
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onViewAllRecords} className="glass-action glass-action-accent px-5 py-3 text-sm font-semibold">
              Open records
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
            <button type="button" className="glass-action px-5 py-3 text-sm">
              Preview review queue
              <span className="material-symbols-outlined text-[18px]">rate_review</span>
            </button>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-4">
        {stats.map((item) => (
          <GlassCard key={item.label} className="p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="text-sm text-text-soft">{item.label}</div>
              <div className={`glass-icon h-10 w-10 border ${tintStyles[item.tint]}`}>
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              </div>
            </div>
            <div className="text-3xl font-semibold tracking-tight text-text-main md:text-[2.2rem]">{item.value}</div>
            <div className="mt-2 text-sm text-text-soft">{item.hint}</div>
          </GlassCard>
        ))}
      </div>

      {dashboard.error ? <Notice tone="error" title="Dashboard sync failed" text={dashboard.error} /> : null}

      <div className="grid gap-5">
        <GlassCard className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-text-main">Recent activity</div>
              </div>
              <button type="button" onClick={onViewAllRecords} className="glass-action px-4 py-2 text-sm">
                View all
              </button>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {dashboard.loading ? (
              <div className="px-5 py-8 text-sm text-text-soft">Loading dashboard…</div>
            ) : dashboard.recentDonations.length ? (
              dashboard.recentDonations.map((donation) => (
                <div key={donation.id} className="flex gap-4 px-5 py-4 transition hover:bg-white/[0.03]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-semibold text-mint">
                    {initials(donation.donor_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-text-main">{donation.donor_name}</div>
                        <div className="mt-1 text-sm text-text-soft">
                          {donation.designation || donation.campaign || 'General support'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-mint">{formatCurrency(donation.amount)}</div>
                        <div className="mt-1 text-xs text-text-soft">{formatDate(donation.donation_date)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-sm text-text-soft">No donations have been created yet.</div>
            )}
          </div>
        </GlassCard>

        {/* System pulse removed per UX request */}
      </div>
    </div>
  );
}

function CreateDonationView({ form, onChange, onFillSample, onSubmit, submission }) {
  const fields = [
    { name: 'donation_id', label: 'Donation ID', placeholder: 'TST-2048' },
    { name: 'donor_name', label: 'Donor name', placeholder: 'Eleanor Vance' },
    { name: 'donor_email', label: 'Email address', placeholder: 'eleanor.v@example.com', type: 'email' },
    { name: 'amount', label: 'Donation amount', placeholder: '5000', type: 'number' },
    { name: 'donation_date', label: 'Donation date', type: 'date' },
    { name: 'currency', label: 'Currency', placeholder: 'USD' },
    { name: 'campaign', label: 'Campaign', placeholder: 'Clean Water Initiative' },
    { name: 'designation', label: 'Designation', placeholder: 'Water Projects' },
  ];

  return (
    <div className="grid gap-5">
      <GlassCard className="p-6 md:p-8 xl:p-10">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="text-xl font-semibold text-text-main">Simulate donation</div>
          </div>
          <button type="button" onClick={onFillSample} className="glass-action px-4 py-2 text-sm">
            Fill sample data
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {fields.map((field) => (
              <label key={field.name} className={field.name === 'campaign' ? 'md:col-span-2' : ''}>
                <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-text-soft">
                  {field.label}
                </div>
                <input
                  name={field.name}
                  type={field.type || 'text'}
                  value={form[field.name]}
                  onChange={onChange}
                  placeholder={field.placeholder}
                  className="w-full rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main placeholder:text-text-soft/60 outline-none transition focus:border-mint/60 focus:bg-white/[0.06] focus:shadow-glow"
                />
              </label>
            ))}

            <label>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-text-soft">
                Recurring status
              </div>
              <select
                name="recurring_status"
                value={form.recurring_status}
                onChange={onChange}
                className="w-full rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
              >
                <option value="one_time">One time</option>
                <option value="recurring">Recurring</option>
                <option value="pledge">Pledge</option>
              </select>
            </label>

            <label>
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.22em] text-text-soft">Source</div>
              <select
                name="source"
                value={form.source}
                onChange={onChange}
                className="w-full rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
              >
                <option value="synthetic">Synthetic</option>
                <option value="manual">Manual</option>
                <option value="imported">Imported</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
            <div />
            <button type="submit" className="glass-action glass-action-accent px-5 py-3 text-sm font-semibold">
              {submission.state === 'saving' ? 'Saving…' : 'Create test donation'}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>

          {submission.message ? (
            <Notice
              tone={submission.state === 'error' ? 'error' : 'success'}
              title={submission.state === 'error' ? 'Could not save donation' : 'Donation saved'}
              text={submission.message}
            />
          ) : null}
        </form>
      </GlassCard>

      <div className="hidden" aria-hidden="true">
        <SideStep title="Backend write" text="Donation hits the Express API and lands in Supabase." />
        <SideStep title="Human review" text="Draft generation and send approval happen after the donation exists." />
        <SideStep title="Records sync" text="The donation table refreshes without needing a page reload." />
      </div>
    </div>
  );
}

function RecordsView({ query, onQueryChange, state, onGenerateDraft }) {
  const totalPages = Math.max(1, Math.ceil(state.pagination.total / state.pagination.limit));

  return (
    <div className="space-y-5">
      <GlassCard className="p-4 md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft">
              search
            </span>
            <input
              value={query.search}
              onChange={(event) => onQueryChange({ search: event.target.value, page: 1 })}
              placeholder="Search donor, amount, campaign, or designation"
              className="w-full rounded-2xl border border-line bg-white/[0.04] py-3 pl-12 pr-4 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
            />
          </div>

          <select
            value={query.status}
            onChange={(event) => onQueryChange({ status: event.target.value, page: 1 })}
            className="rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
          >
            <option value="">All statuses</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="draft_created">Draft created</option>
            <option value="approved">Approved</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>

          <div className="rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-sm text-text-soft">
            Showing {state.rows.length} of {state.pagination.total}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left">
            <thead className="border-b border-line bg-white/[0.03] text-xs uppercase tracking-[0.2em] text-text-soft">
              <tr>
                <th className="px-5 py-4">Donor</th>
                <th className="px-5 py-4">Gift</th>
                <th className="px-5 py-4">Campaign</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Synced donor</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {state.loading ? (
                <tr>
                  <td className="px-5 py-8 text-sm text-text-soft" colSpan="6">
                    Loading donation records…
                  </td>
                </tr>
              ) : state.error ? (
                <tr>
                  <td className="px-5 py-8" colSpan="6">
                    <Notice tone="error" title="Records failed to load" text={state.error} />
                  </td>
                </tr>
              ) : state.rows.length ? (
                state.rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-mint">
                          {initials(row.donor_name)}
                        </div>
                        <div>
                          <div className="font-medium text-text-main">{row.donor_name}</div>
                          <div className="text-sm text-text-soft">{row.donor_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-mint">{formatCurrency(row.amount)}</td>
                    <td className="px-5 py-4 text-sm text-text-soft">{row.campaign || row.designation || 'General support'}</td>
                    <td className="px-5 py-4">
                      <StatusChip status={row.acknowledgment_status} />
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-text-soft">
                      {row.donor ? row.donor.full_name || row.donor.email : 'No matched donor'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onGenerateDraft(row.donation_id || row.id)}
                        className="glass-action px-4 py-2 text-sm"
                      >
                        Generate draft
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-8 text-sm text-text-soft" colSpan="6">
                    No records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-4 text-sm text-text-soft">
          <div>
            Page {state.pagination.page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state.pagination.page <= 1}
              onClick={() => onQueryChange({ page: Math.max(1, state.pagination.page - 1) })}
              className="glass-action px-4 py-2 text-text-main disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={state.pagination.page >= totalPages}
              onClick={() => onQueryChange({ page: Math.min(totalPages, state.pagination.page + 1) })}
              className="glass-action px-4 py-2 text-text-main disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function ReviewQueueView({ query, state, onQueryChange, onOpenDraft, onGenerateDraft, onBatchApprove, onBatchSend, onResetFilters, bulkSummary }) {
  const totalPages = Math.max(1, Math.ceil(state.pagination.total / state.pagination.limit));
  const approvalSummary = bulkSummary?.approval || null;
  const sendSummary = bulkSummary?.send || null;
  const allApproved = Boolean(
    approvalSummary &&
      Number(approvalSummary.total || 0) > 0 &&
      Number(approvalSummary.failureCount || 0) === 0 &&
      Number(approvalSummary.successCount || 0) === Number(approvalSummary.total || 0),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="text-2xl font-semibold text-text-main">Review queue</div>
          <div className="mt-2 max-w-2xl text-sm text-text-soft">
            Review live drafts, filter by review state, and jump straight into a draft when a human needs to approve or edit.
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onResetFilters} className="glass-action px-4 py-2 text-sm">
            Reset filters
          </button>
          <button type="button" onClick={onBatchApprove} className="glass-action glass-action-accent px-4 py-2 text-sm font-semibold">
            Batch approve
          </button>
          <button
            type="button"
            onClick={onBatchSend}
            disabled={!allApproved}
            className="glass-action glass-action-accent px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Batch send
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`glass-chip px-3 py-1.5 text-xs uppercase tracking-[0.22em] ${allApproved ? 'text-mint' : 'text-amber'}`}>
          {approvalSummary
            ? `${approvalSummary.successCount}/${approvalSummary.total} approved`
            : 'Awaiting batch approval'}
        </span>
        <span className={`glass-chip px-3 py-1.5 text-xs uppercase tracking-[0.22em] ${allApproved ? 'text-mint' : 'text-text-soft'}`}>
          {allApproved ? 'All approved, ready to send' : 'Approve all drafts before batch send'}
        </span>
        {sendSummary ? (
          <span className={`glass-chip px-3 py-1.5 text-xs uppercase tracking-[0.22em] ${Number(sendSummary.failureCount || 0) > 0 ? 'text-rose' : 'text-sky'}`}>
            {Number(sendSummary.failureCount || 0) > 0
              ? `${sendSummary.successCount}/${sendSummary.total} sent`
              : `${sendSummary.successCount}/${sendSummary.total} sent`}
          </span>
        ) : null}
      </div>

      <GlassCard className="p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] xl:items-center">
          <div className="relative">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-soft">
              search
            </span>
            <input
              value={query.search}
              onChange={(event) => onQueryChange((current) => ({ ...current, search: event.target.value, page: 1 }))}
              placeholder="Search donor, donation ID, or subject"
              className="w-full rounded-2xl border border-line bg-white/[0.04] py-3 pl-12 pr-4 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
            />
          </div>

          <select
            value={query.review_status}
            onChange={(event) => onQueryChange((current) => ({ ...current, review_status: event.target.value, page: 1 }))}
            className="rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
          >
            <option value="">All review states</option>
            <option value="pending_review">Pending review</option>
            <option value="edited">Edited</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={query.email_status}
            onChange={(event) => onQueryChange((current) => ({ ...current, email_status: event.target.value, page: 1 }))}
            className="rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
          >
            <option value="">All email states</option>
            <option value="draft_created">Draft created</option>
            <option value="cancelled">Cancelled</option>
            <option value="sent">Sent</option>
          </select>

          <select
            value={query.match_status}
            onChange={(event) => onQueryChange((current) => ({ ...current, match_status: event.target.value, page: 1 }))}
            className="rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
          >
            <option value="">All match states</option>
            <option value="matched">Matched</option>
            <option value="manual">Manual</option>
            <option value="uncertain">Uncertain</option>
          </select>
        </div>
      </GlassCard>

      {state.error ? <Notice tone="error" title="Draft queue failed to load" text={state.error} /> : null}

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left">
            <thead className="border-b border-line bg-white/[0.03] text-xs uppercase tracking-[0.2em] text-text-soft">
              <tr>
                <th className="px-5 py-4">Donor</th>
                <th className="px-5 py-4">Donation</th>
                <th className="px-5 py-4">Review</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Match</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {state.loading ? (
                <tr>
                  <td className="px-5 py-8 text-sm text-text-soft" colSpan="6">
                    Loading draft queue…
                  </td>
                </tr>
              ) : state.rows.length ? (
                state.rows.map((row) => {
                  const donation = row.donation || {};
                  const donorName = row.donor?.full_name || donation.donor_name || row.donor_name || 'Unknown donor';
                  const donationId = donation.donation_id || row.donation_id || row.donation?.id || row.id;
                  const matchLabel = row.match_status || 'unknown';
                  const reviewLabel = row.review_status || 'pending_review';
                  const emailLabel = row.email_status || 'draft_created';

                  return (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-2 text-xs font-semibold text-mint">
                            {initials(donorName)}
                          </div>
                          <div>
                            <div className="font-medium text-text-main">{donorName}</div>
                            <div className="text-sm text-text-soft">{row.donor?.email || donation.donor_email || 'No donor email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono text-sm text-mint">{formatCurrency(donation.amount || row.amount)}</div>
                        <div className="mt-1 text-xs text-text-soft">{donationId}</div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusChip status={reviewLabel} label={reviewLabel.replace(/_/g, ' ')} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusChip status={emailLabel} label={emailLabel.replace(/_/g, ' ')} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusChip status={matchLabel} label={matchLabel.replace(/_/g, ' ')} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenDraft(row.id)}
                            className="glass-action px-4 py-2 text-sm"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            disabled={!donationId}
                            onClick={() => onGenerateDraft(donationId)}
                            className="glass-action glass-action-accent px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Regenerate
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-5 py-8 text-sm text-text-soft" colSpan="6">
                    No drafts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-line px-5 py-4 text-sm text-text-soft">
          <div>
            Page {state.pagination.page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={state.pagination.page <= 1}
              onClick={() => onQueryChange((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
              className="glass-action px-4 py-2 text-text-main disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={state.pagination.page >= totalPages}
              onClick={() => onQueryChange((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))}
              className="glass-action px-4 py-2 text-text-main disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function DraftReviewView({
  mode,
  draftForm,
  setDraftForm,
  draftDetailState,
  draftNotice,
  draftSubject,
  setDraftSubject,
  draftBody,
  setDraftBody,
  onGenerateDraft,
  onSaveDraft,
  onApproveDraft,
  onRejectDraft,
  onRewriteDraft,
  onOpenReviews,
}) {
  const record = draftDetailState.record;
  const donation = record?.donation || {};
  const donorName = record?.donor?.full_name || donation.donor_name || 'Unknown donor';
  const donorEmail = record?.donor?.email || donation.donor_email || 'No donor email';
  const donationId = donation.donation_id || record?.donation_id || draftForm.donationId || '';
  const isGenerateMode = mode === 'new';
  const reasoningTags = [record?.match_status, record?.review_status, record?.email_status].filter(Boolean);
  const previewReasoning = record?.reasoning || record?.review_notes || 'The draft is ready for human review and approval before any email can be sent.';

  return (
    <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-5">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="text-lg font-semibold text-text-main">{isGenerateMode ? 'Generate draft' : 'Donation summary'}</div>
            <div className="flex gap-2">
              <button type="button" onClick={onOpenReviews} className="glass-chip px-3 py-1 text-xs uppercase tracking-[0.22em] text-text-main">
                Queue
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.22em] text-text-soft">Donation ID</div>
              <input
                value={draftForm.donationId}
                onChange={(event) => setDraftForm((current) => ({ ...current, donationId: event.target.value }))}
                placeholder="DON-1002"
                className="w-full rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
              />
            </label>

            <button type="button" onClick={() => onGenerateDraft(draftForm.donationId)} className="glass-action glass-action-accent w-full justify-center px-5 py-3 text-sm font-semibold">
              {draftDetailState.generating ? 'Generating…' : 'Generate draft'}
            </button>
          </div>

          {draftNotice.message ? (
            <div className="mt-5">
              <Notice
                tone={draftNotice.type === 'error' ? 'error' : 'success'}
                title={draftNotice.type === 'error' ? 'Draft action failed' : 'Draft action complete'}
                text={draftNotice.message}
              />
            </div>
          ) : null}

          {draftDetailState.error ? (
            <div className="mt-4">
              <Notice tone="error" title="Draft load failed" text={draftDetailState.error} />
            </div>
          ) : null}

          {isGenerateMode ? (
            <div className="mt-4 rounded-2xl border border-line bg-white/[0.03] p-4 text-sm leading-6 text-text-soft">
              Enter a donation ID and generate a stewardship draft. The backend will draft the thank-you copy, but sending still waits for human approval.
            </div>
          ) : null}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="text-lg font-semibold text-text-main">Donor context</div>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-sm font-semibold text-mint">
              {initials(donorName)}
            </div>
            <div>
              <div className="font-medium text-text-main">{donorName}</div>
              <div className="text-sm text-text-soft">{donorEmail}</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <SummaryTile label="Amount" value={formatCurrency(donation.amount || record?.amount)} accent />
            <SummaryTile label="Date" value={formatDate(donation.donation_date || record?.created_at)} />
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-[0.22em] text-text-soft">Designation</div>
              <div className="mt-2 text-sm text-text-main">{donation.designation || donation.campaign || 'General support'}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-[0.22em] text-text-soft">Donation ID</div>
              <div className="mt-2 text-sm text-text-main">{donationId || 'No donation selected'}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="overflow-hidden p-5">
          <div className="border-b border-line pb-4 text-lg font-semibold text-text-main">Reasoning</div>
          <p className="mt-4 text-sm leading-7 text-text-soft">{previewReasoning}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {reasoningTags.length ? reasoningTags.map((tag) => (
              <span key={tag} className="glass-chip px-3 py-1 text-xs text-text-main">
                {String(tag).replace(/_/g, ' ')}
              </span>
            )) : (
              <span className="glass-chip px-3 py-1 text-xs text-text-main">Awaiting draft metadata</span>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="flex min-h-[42rem] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-2 text-text-soft">
            <button type="button" onClick={onRewriteDraft} className="glass-action glass-action-accent px-3 py-2 text-xs font-semibold text-mint">
              Rewrite
            </button>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={record?.review_status} label={(record?.review_status || 'new').replace(/_/g, ' ')} />
            <StatusChip status={record?.email_status} label={(record?.email_status || 'not sent').replace(/_/g, ' ')} />
          </div>
        </div>

        <div className="flex-1 space-y-4 bg-surface/70 p-5">
          {draftDetailState.loading ? (
            <div className="rounded-2xl border border-line bg-white/[0.03] p-4 text-sm text-text-soft">Loading draft details…</div>
          ) : null}

          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.22em] text-text-soft">Subject line</div>
            <input
              value={draftSubject}
              onChange={(event) => setDraftSubject(event.target.value)}
              placeholder="Warm thank-you draft"
              className="w-full rounded-2xl border border-line bg-white/[0.04] px-4 py-3 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
            />
          </div>

          <div className="flex min-h-[34rem] flex-col">
            <div className="mb-2 text-xs uppercase tracking-[0.22em] text-text-soft">Message body</div>
            <textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder="Generate a draft to populate this message body."
              className="min-h-[28rem] flex-1 rounded-2xl border border-line bg-white/[0.04] px-5 py-4 text-sm leading-7 text-text-main outline-none transition focus:border-mint/60 focus:shadow-glow"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-white/[0.03] px-5 py-4">
          <button type="button" onClick={onRejectDraft} className="glass-action px-5 py-3 text-sm font-semibold text-rose">
            Reject draft
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onSaveDraft} className="glass-action px-5 py-3 text-sm">
              Save draft
            </button>
            <button type="button" onClick={onApproveDraft} className="glass-action glass-action-accent px-6 py-3 text-sm font-semibold">
              Approve &amp; send
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function GlassCard({ className = '', children }) {
  return (
    <section className={`glass-card rounded-[1.35rem] ${className}`.trim()}>
      {children}
    </section>
  );
}

function Notice({ tone = 'success', title, text }) {
  const toneClasses =
    tone === 'error'
      ? 'border-rose/20 bg-rose/10 text-rose'
      : 'border-mint/20 bg-mint/10 text-mint';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses}`}>
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-text-soft">{text}</div>
    </div>
  );
}

function SideStep({ title, text }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/90 p-4 shadow-soft">
      <div className="font-medium text-text-main">{title}</div>
      <div className="mt-1 text-sm leading-6 text-text-soft">{text}</div>
    </div>
  );
}

function PulseRow({ label, value, tone }) {
  const toneStyles = {
    mint: 'text-mint',
    sky: 'text-sky',
    amber: 'text-amber',
    rose: 'text-rose',
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-soft">{label}</span>
      <span className={`font-mono ${toneStyles[tone] || 'text-text-main'}`}>{value}</span>
    </div>
  );
}

function SummaryTile({ label, value, accent = false }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.22em] text-text-soft">{label}</div>
      <div className={`mt-2 text-sm ${accent ? 'font-mono text-2xl text-mint' : 'text-text-main'}`}>{value}</div>
    </div>
  );
}

function StatusChip({ status, label }) {
  const raw = (label || status || '').toLowerCase();
  const map = {
    high: 'glass-chip text-mint border-mint/20',
    medium: 'glass-chip text-amber border-amber/20',
    uncertain: 'glass-chip text-rose border-rose/20',
    received: 'glass-chip text-sky border-sky/20',
    approved: 'glass-chip text-mint border-mint/20',
    sent: 'glass-chip text-sky border-sky/20',
    failed: 'glass-chip text-rose border-rose/20',
    pending_review: 'glass-chip text-amber border-amber/20',
    edited: 'glass-chip text-sky border-sky/20',
    draft_created: 'glass-chip text-mint border-mint/20',
    cancelled: 'glass-chip text-rose border-rose/20',
    rejected: 'glass-chip text-rose border-rose/20',
    matched: 'glass-chip text-mint border-mint/20',
    manual: 'glass-chip text-amber border-amber/20',
  };

  const className = map[raw] || 'glass-chip text-text-soft border-line';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${className}`}>
      {label || status || 'Unknown'}
    </span>
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export default App;
