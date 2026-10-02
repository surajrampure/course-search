// Search aliases connect course topics; they do not assert mathematical identity.
const topics = [
  ['absolute loss', ['absolute loss', 'mean absolute error', 'mean absolute loss', 'absolute error', 'mae', 'l1 loss', 'l 1 loss']],
  ['squared loss', ['squared loss', 'square loss', 'squared error', 'mean squared error', 'mean square error', 'mean squared loss', 'mse', 'l2 loss', 'l 2 loss']],
  ['dot product', ['dot product', 'inner product', 'scalar product']],
  ['linear regression', ['linear regression', 'linear least squares']],
];
const wordAliases = {proj:'projection',project:'projection',projecting:'projection',projections:'projection',orthogonality:'orthogonal',perpendicular:'orthogonal',perpendicularity:'orthogonal',perpendicularly:'orthogonal',independent:'independence',dependent:'dependence',vectors:'vector',matrices:'matrix',norms:'norm',bases:'basis'};
const ignored = new Set('what are you looking for the a an is of to in how why about explain me do does can find tell please when where which with and or by we our us my would should could'.split(' '));
const spellingWords = new Set((topics.flatMap(([name, names]) => [name, ...names]).join(' ') + ' ' + Object.keys(wordAliases).join(' ') + ' ' + Object.values(wordAliases).join(' ') + ' absolute orthonormal orthogonal projection linear independence dependence span basis dimension vector matrix norm magnitude length squared loss error empirical risk regression correlation covariance derivative derivatives partial gradient descent eigenvalue eigenvalues eigenvector eigenvectors invertible inverse transpose determinant rank null nullity column space rows columns hypothesis parameter parameters function optimization minimize median mean constant intercept slope least squares probability conditional distribution variance standard deviation summation calculus convex concave diagonal symmetric singular value decomposition frobenius pythagorean').match(/[a-z]+/g));
const phrases = topics.flatMap(([name, names]) => names.map(alias => ({name, pattern:new RegExp('\\b' + alias.replaceAll(' ', '[\\s-]+') + '\\b', 'g')}))).sort((a,b) => b.pattern.source.length - a.pattern.source.length);

export function normalizeText(text) {
  let normalized = text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
  for (const {name, pattern} of phrases) normalized = normalized.replace(pattern, name);
  return normalized.replace(/\b[a-z]+\b/g, word => Object.hasOwn(wordAliases, word) ? wordAliases[word] : word);
}

export function normalizeQuery(query) {
  const normalized = normalizeText(query);
  // "absolute" is a course-search shorthand; "absolute value" stays specific.
  return normalized;
}

export const tokens = text => (normalizeText(text).match(/[a-z0-9]+/g) || []).filter(word => !ignored.has(word));

// Adjacent transpositions count as one edit, as in "porjection".
function distance(a, b) {
  const rows = Array.from({length:a.length + 1}, () => new Uint16Array(b.length + 1));
  for (let i=0;i<=a.length;i++) rows[i][0]=i;
  for (let j=0;j<=b.length;j++) rows[0][j]=j;
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++) {
    rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+Number(a[i-1]!==b[j-1]));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
  }
  return rows[a.length][b.length];
}

export function createQueryProcessor(records, {shorthand={}}={}) {
  // All observed words protect valid vocabulary. Only curated course words are
  // correction candidates, so OCR mistakes and names cannot become suggestions.
  const known = new Set([...spellingWords, ...records.flatMap(record => (`${record.title} ${record.section} ${record.text}`).toLowerCase().match(/[a-z]+/g) || [])]);
  return (query, {correct=true}={}) => {
    const corrections=[];
    const corrected=query.normalize('NFKC').replace(/\\[a-z]+|\b[a-z]+\b/gi, word => {
      const lower=word.toLowerCase();
      if(!correct||word.startsWith('\\')||lower.length<4||known.has(lower)) return word;
      const limit=lower.length>=8?2:1;
      let best=limit+1,candidates=[];
      for(const candidate of spellingWords) {
        if(Math.abs(candidate.length-lower.length)>limit) continue;
        const edits=distance(lower,candidate);
        if(edits<best){best=edits;candidates=[candidate];}else if(edits===best)candidates.push(candidate);
      }
      if(best>limit||candidates.length!==1) return word;
      corrections.push({from:word,to:candidates[0]});
      return candidates[0];
    });
    const normalized=normalizeQuery(corrected);
    return {normalized:shorthand[normalized] || normalized,corrected,corrections};
  };
}
