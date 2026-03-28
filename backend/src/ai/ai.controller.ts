@Get('orcid/:id')
async orcidLookup(@Param('id') id: string) {
  try {
    const headers = { Accept: 'application/json' };
    const [person, works, employments, educations] = await Promise.all([
      fetch(`https://pub.orcid.org/v3.0/${id}/person`, { headers }).then(r => r.json()),
      fetch(`https://pub.orcid.org/v3.0/${id}/works`, { headers }).then(r => r.json()),
      fetch(`https://pub.orcid.org/v3.0/${id}/employments`, { headers }).then(r => r.json()),
      fetch(`https://pub.orcid.org/v3.0/${id}/educations`, { headers }).then(r => r.json()),
    ]);

    const name = person?.name;
    const firstName = name?.['given-names']?.value || '';
    const lastName = name?.['family-name']?.value || '';
    const biography = person?.biography?.content || '';
    const keywords = person?.keywords?.keyword?.map((k: any) => k.content) || [];

    const workList = (works?.group || []).slice(0, 20).map((g: any) => {
      const ws = g['work-summary']?.[0];
      return {
        title: ws?.title?.title?.value || '',
        year: ws?.['publication-date']?.year?.value || '',
        type: ws?.type || '',
        journal: ws?.['journal-title']?.value || '',
        doi: ws?.['external-ids']?.['external-id']?.find((e: any) => e['external-id-type'] === 'doi')?.['external-id-value'] || '',
      };
    }).filter((w: any) => w.title);

    const employmentList = (employments?.['affiliation-group'] || []).map((g: any) => {
      const s = g.summaries?.[0]?.['employment-summary'];
      return {
        organization: s?.organization?.name || '',
        role: s?.['role-title'] || '',
        department: s?.['department-name'] || '',
        startYear: s?.['start-date']?.year?.value || '',
        endYear: s?.['end-date']?.year?.value || '',
        current: !s?.['end-date'],
      };
    }).filter((e: any) => e.organization);

    const educationList = (educations?.['affiliation-group'] || []).map((g: any) => {
      const s = g.summaries?.[0]?.['education-summary'];
      return {
        organization: s?.organization?.name || '',
        role: s?.['role-title'] || '',
        department: s?.['department-name'] || '',
        startYear: s?.['start-date']?.year?.value || '',
        endYear: s?.['end-date']?.year?.value || '',
      };
    }).filter((e: any) => e.organization);

    return { firstName, lastName, biography, keywords, works: workList, employments: employmentList, educations: educationList };
  } catch (e) {
    return { error: 'ORCID verisi alınamadı' };
  }
}
