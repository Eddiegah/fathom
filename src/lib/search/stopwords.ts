/** A standard, small English stopword list - high-frequency function
 * words that carry little discriminative meaning for ranking and would
 * otherwise dominate postings lists (nearly every document contains
 * "the"). Removing them shrinks the index and keeps BM25's IDF term
 * meaningful. */
export const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any",
  "are", "aren't", "as", "at", "be", "because", "been", "before", "being", "below",
  "between", "both", "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't",
  "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
  "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having",
  "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i",
  "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off",
  "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
  "over", "own", "same", "she", "should", "shouldn't", "so", "some", "such", "than",
  "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
  "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "wasn't", "we", "were", "weren't", "what", "when", "where", "which",
  "while", "who", "whom", "why", "with", "won't", "would", "wouldn't", "you", "your",
  "yours", "yourself", "yourselves",
]);
