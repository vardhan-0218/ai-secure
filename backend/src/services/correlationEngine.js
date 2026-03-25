/**
 * Correlation Engine
 * Cross-log analysis: links IPs, credential types,
 * and attack signatures across multiple findings/logs.
 */

/**
 * Correlate findings across a dataset.
 * @param {Array} findings - All enriched findings
 * @param {Array} lineAnalysis - Line-level log analysis
 * @returns {object} Correlation clusters
 */
function correlateFIndings(findings, lineAnalysis = []) {
  const ipMap     = {};   // IP → [lineNumbers]
  const typeMap   = {};   // findingType → [lineNumbers]
  const ipRegex   = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

  // Map IPs to lines
  lineAnalysis.forEach(({ lineNumber, content }) => {
    const matches = content?.match(ipRegex) || [];
    matches.forEach(ip => {
      if (!ipMap[ip]) ipMap[ip] = [];
      ipMap[ip].push(lineNumber);
    });
  });

  // Map types to lines
  findings.forEach(f => {
    if (!typeMap[f.type]) typeMap[f.type] = [];
    typeMap[f.type].push(f.line || 0);
  });

  // Build IP clusters (IPs appearing on multiple lines)
  const ipClusters = Object.entries(ipMap)
    .filter(([, lines]) => lines.length >= 2)
    .map(([ip, lines]) => ({
      ip,
      occurrences: lines.length,
      lines,
      risk: lines.length >= 5 ? 'critical' : lines.length >= 3 ? 'high' : 'medium',
      description: `IP ${ip} appears ${lines.length} times across lines ${lines.slice(0, 5).join(', ')}${lines.length > 5 ? '...' : ''}`,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  // Build type co-occurrence matrix
  const coOccurrence = [];
  const types = Object.keys(typeMap);
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      const shared = typeMap[types[i]].filter(l => typeMap[types[j]].includes(l));
      if (shared.length > 0) {
        coOccurrence.push({
          typeA: types[i],
          typeB: types[j],
          sharedLines: shared,
          risk: 'high',
          description: `${types[i]} and ${types[j]} co-occur on line(s) ${shared.join(', ')} — indicates compound vulnerability`,
        });
      }
    }
  }

  // Critical finding lines
  const criticalLines = findings
    .filter(f => f.risk === 'critical')
    .map(f => f.line)
    .filter(Boolean);

  return {
    ipClusters,
    coOccurrence,
    criticalLines: [...new Set(criticalLines)],
    summary: buildCorrelationSummary(ipClusters, coOccurrence),
  };
}

function buildCorrelationSummary(ipClusters, coOccurrence) {
  const parts = [];
  if (ipClusters.length > 0)
    parts.push(`${ipClusters.length} repeated IP(s) detected. Top: ${ipClusters[0].ip} (${ipClusters[0].occurrences} occurrences).`);
  if (coOccurrence.length > 0)
    parts.push(`${coOccurrence.length} compound vulnerability/vulnerabilities where multiple risk types appear on the same log line.`);
  return parts.length ? parts.join(' ') : 'No significant correlations detected.';
}

module.exports = { correlateFIndings };
