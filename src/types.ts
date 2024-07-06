// Options types
export type ResultFilterValue =
  | "discussions"
  | "faq"
  | "infobox"
  | "news"
  | "query"
  | "summarizer"
  | "videos"
  | "web";

export type ResultFilterType = ResultFilterValue | string;

export interface BraveSearchOptions {
  country?: string;
  search_lang?: string;
  ui_lang?: string;
  safesearch?: "off" | "moderate" | "strict";
  freshness?: "pd" | "pw" | "pm" | "py" | string;
  text_decorations?: boolean;
  spellcheck?: boolean;
  goggles_id?: string;
  units?: "metric" | "imperial";
  extra_snippets?: boolean;
  count?: number;
  result_filter?: ResultFilterType;
  summary?: boolean;
}

export interface SummarizerOptions {
  entity_info?: boolean;
}

export interface LocalPoiOptions {
  // Add any specific options for Local POI search if needed
}

export interface LocalDescriptionsOptions {
  // Add any specific options for Local Descriptions search if needed
}

// Response types

export interface WebSearchApiResponse {
  type: "search";
  discussions?: Discussions;
  faq?: FAQ;
  infobox?: GraphInfobox;
  locations?: Locations;
  mixed?: MixedResponse;
  news?: News;
  query: Query;
  videos?: Videos;
  web?: Search;
  summarizer?: Summarizer;
}

export interface SummarizerSearchApiResponse {
  type: "summarizer";
  status: "failed" | "complete";
  title?: string;
  summary?: SummaryMessage[];
  enrichments?: SummaryEnrichments;
  followups?: string[];
  entities_infos?: { [key: string]: SummaryEntityInfo };
}

export interface LocalPoiSearchApiResponse {
  type: "local_pois";
  results: LocationResult[];
}

export interface LocalDescriptionsSearchApiResponse {
  type: "local_descriptions";
  results: LocationDescription[];
}

// Common types

export interface MetaUrl {
  scheme: string;
  netloc: string;
  hostname: string;
  favicon: string;
  path: string;
}

export interface Thumbnail {
  src: string;
  alt?: string;
  height?: number;
  width?: number;
  bg_color?: string;
  original?: string;
  logo?: boolean;
  duplicated?: boolean;
  theme?: string;
}

export interface Rating {
  ratingValue: number;
  bestRating: number;
  reviewCount: number;
  profile?: Profile;
  is_tripadvisor?: boolean;
}

export interface Profile {
  name: string;
  long_name?: string;
  url: string;
  img: string;
}

export interface Unit {
  value: number;
  units: string;
}

// Specific types for each part of the response

export interface Discussions {
  type: "search";
  results: DiscussionResult[];
  mutated_by_goggles: boolean;
}

export interface DiscussionResult extends Omit<SearchResult, "type"> {
  type: "discussion";
  data: ForumData;
}

export interface ForumData {
  forum_name: string;
  num_answers: number;
  score: string;
  title: string;
  question: string;
  top_comment: string;
}

export interface FAQ {
  type: "faq";
  results: QA[];
}

export interface QA {
  question: string;
  answer: string;
  title: string;
  url: string;
  meta_url: MetaUrl;
}

export interface GraphInfobox {
  type: "graph";
  results: GenericInfobox | QAInfobox | InfoboxPlace | InfoboxWithLocation;
}

export interface AbstractGraphInfobox extends Result {
  type: "infobox";
  position: number;
  label?: string;
  category?: string;
  long_desc?: string;
  thumbnail?: Thumbnail;
  attributes?: string[][];
  profiles?: Profile[] | DataProvider[];
  website_url?: string;
  ratings?: Rating[];
  providers?: DataProvider[];
  distance?: Unit;
  images?: Thumbnail[];
  movie?: MovieData;
}

export interface GenericInfobox extends AbstractGraphInfobox {
  subtype: "generic";
  found_in_urls: string[];
}

export interface QAInfobox extends AbstractGraphInfobox {
  subtype: "code";
  data: QAPage;
  meta_url: MetaUrl;
}

export interface InfoboxWithLocation extends AbstractGraphInfobox {
  subtype: "location";
  is_location: boolean;
  coordinates: [number, number];
  zoom_level: number;
  location: LocationResult;
}

export interface InfoboxPlace extends AbstractGraphInfobox {
  subtype: "place";
  location: LocationResult;
}

export interface Locations {
  type: "locations";
  results: LocationResult[];
}

export interface MixedResponse {
  type: "mixed";
  main: ResultReference[];
  top: ResultReference[];
  side: ResultReference[];
}

export interface ResultReference {
  type: string;
  index: number;
  all: boolean;
}

export interface News {
  type: "news";
  results: NewsResult[];
  mutated_by_goggles: boolean;
}

export interface Query {
  original: string;
  show_strict_warning: boolean;
  altered: string;
  safesearch: boolean;
  is_navigational: boolean;
  is_geolocal: boolean;
  local_decision: string;
  local_locations_idx: number;
  is_trending: boolean;
  is_news_breaking: boolean;
  ask_for_location: boolean;
  language: Language;
  spellcheck_off: boolean;
  country: string;
  bad_results: boolean;
  should_fallback: boolean;
  lat?: string;
  long?: string;
  postal_code?: string;
  city?: string;
  state?: string;
  header_country: string;
  more_results_available: boolean;
  custom_location_label?: string;
  reddit_cluster?: string;
  summary_key?: string;
}

export interface Videos {
  type: "videos";
  results: VideoResult[];
  mutated_by_goggles: boolean;
}

export interface Search {
  type: "search";
  results: SearchResult[];
  family_friendly: boolean;
}

export interface Summarizer {
  type: "summarizer";
  key: string;
}

// Result types

export interface Result {
  title: string;
  url: string;
  is_source_local?: boolean;
  is_source_both?: boolean;
  description: string;
  page_age?: string;
  page_fetched?: string;
  profile?: Profile;
  language?: string;
  family_friendly: boolean;
}

export interface SearchResult extends Result {
  type: "search_result";
  subtype: "generic";
  deep_results?: DeepResult;
  schemas?: any[][];
  meta_url: MetaUrl;
  thumbnail?: Thumbnail;
  age?: string;
  language?: string;
  location?: LocationResult;
  video?: VideoData;
  movie?: MovieData;
  faq?: FAQ;
  qa?: QAPage;
  book?: Book;
  rating?: Rating;
  article?: Article;
  product?: ProductReview;
  product_cluster?: ProductReview[];
  cluster_type?: string;
  cluster?: Result[];
  creative_work?: CreativeWork;
  music_recording?: MusicRecording;
  review?: Review;
  software?: Software;
  recipe?: Recipe;
  organization?: Organization;
  content_type?: string;
  extra_snippets?: string[];
}

export interface NewsResult extends Result {
  meta_url: MetaUrl;
  source: string;
  breaking: boolean;
  thumbnail?: Thumbnail;
  age: string;
  extra_snippets?: string[];
}

export interface VideoResult extends Result {
  type: "video_result";
  video: VideoData;
  meta_url: MetaUrl;
  thumbnail: Thumbnail;
  age: string;
}

export interface LocationResult extends Result {
  type: "location_result";
  id: string;
  provider_url: string;
  coordinates: [number, number];
  zoom_level: number;
  thumbnail?: Thumbnail;
  postal_address: PostalAddress;
  opening_hours?: OpeningHours;
  contact?: Contact;
  price_range?: string;
  rating?: Rating;
  distance?: Unit;
  profiles?: DataProvider[];
  reviews?: Reviews;
  pictures?: PictureResults;
  action?: Action;
  serves_cuisine?: string[];
  categories?: string[];
  icon_category?: string;
  results?: LocationWebResult;
  timezone?: string;
  timezone_offset?: string;
}

export interface LocationDescription {
  type: "local_description";
  id: string;
  description: string;
}

// Additional types

export interface Language {
  main: string;
}

export interface DeepResult {
  news?: NewsResult[];
  buttons?: ButtonResult[];
  social?: KnowledgeGraphProfile[];
  videos?: VideoResult[];
  images?: Image[];
}

export interface ButtonResult {
  type: "button_result";
  title: string;
  url: string;
}

export interface KnowledgeGraphProfile {
  title: string;
  description: string;
  url: string;
  thumbnail: string;
}

export interface Image {
  thumbnail: Thumbnail;
  url: string;
  properties: ImageProperties;
}

export interface ImageProperties {
  url: string;
  resized: string;
  height: number;
  width: number;
  format: string;
  content_size: string;
}

export interface VideoData {
  duration: string;
  views: string;
  creator: string;
  publisher: string;
  thumbnail: Thumbnail;
}

export interface MovieData {
  name: string;
  description: string;
  url: string;
  thumbnail: Thumbnail;
  release: string;
  directors: Person[];
  actors: Person[];
  rating: Rating;
  duration: string;
  genre: string[];
  query: string;
}

export interface QAPage {
  question: string;
  answer: Answer;
}

export interface Answer {
  text: string;
  author: string;
  upvoteCount: number;
  downvoteCount: number;
}

export interface Book {
  title: string;
  author: Person[];
  date: string;
  price: Price;
  pages: number;
  publisher: Person;
  rating: Rating;
}

export interface Price {
  price: string;
  price_currency: string;
}

export interface Article {
  author: Person[];
  date: string;
  publisher: Organization;
  thumbnail: Thumbnail;
  isAccessibleForFree: boolean;
}

export interface ProductReview {
  name: string;
  price: string;
  thumbnail: Thumbnail;
  description: string;
  offers: Offer[];
  rating: Rating;
}

export interface Offer {
  url: string;
  priceCurrency: string;
  price: string;
}

export interface CreativeWork {
  name: string;
  thumbnail: Thumbnail;
  rating: Rating;
}

export interface MusicRecording {
  name: string;
  thumbnail: Thumbnail;
  rating: Rating;
}

export interface Review {
  type: "review";
  name: string;
  thumbnail: Thumbnail;
  description: string;
  rating: Rating;
}

export interface Software {
  name: string;
  author: string;
  version: string;
  codeRepository: string;
  homepage: string;
  datePublisher: string;
  is_npm: boolean;
  is_pypi: boolean;
  stars: number;
  forks: number;
  ProgrammingLanguage: string;
}

export interface Recipe {
  title: string;
  description: string;
  thumbnail: Thumbnail;
  url: string;
  domain: string;
  favicon: string;
  time: string;
  prep_time: string;
  cook_time: string;
  ingredients: string;
  instructions: HowTo[];
  servings: number;
  calories: number;
  rating: Rating;
  recipeCategory: string;
  recipeCuisine: string;
  video: VideoData;
}

export interface HowTo {
  text: string;
  name: string;
  url: string;
  image: string[];
}

export interface Organization {
  type: "organization";
  name: string;
  url: string;
  thumbnail: Thumbnail;
  contact_points: ContactPoint[];
}

export interface ContactPoint {
  type: "contact_point";
  telephone: string;
  email: string;
}

export interface Person {
  type: "person";
  name: string;
  url: string;
  thumbnail: Thumbnail;
}

export interface PostalAddress {
  type: "PostalAddress";
  country: string;
  postalCode: string;
  streetAddress: string;
  addressRegion: string;
  addressLocality: string;
  displayAddress: string;
}

export interface OpeningHours {
  current_day: DayOpeningHours[];
  days: DayOpeningHours[][];
}

export interface DayOpeningHours {
  abbr_name: string;
  full_name: string;
  opens: string;
  closes: string;
}

export interface Contact {
  email?: string;
  telephone?: string;
}

export interface DataProvider {
  type: "external";
  name: string;
  url: string;
  long_name?: string;
  img?: string;
}

export interface Reviews {
  results: TripAdvisorReview[];
  viewMoreUrl: string;
  reviews_in_foreign_language: boolean;
}

export interface TripAdvisorReview {
  title: string;
  description: string;
  date: string;
  rating: Rating;
  author: Person;
  review_url: string;
  language: string;
}

export interface PictureResults {
  viewMoreUrl: string;
  results: Thumbnail[];
}

export interface Action {
  type: string;
  url: string;
}

export interface LocationWebResult extends Result {
  meta_url: MetaUrl;
}

export interface SummaryMessage {
  type: "token" | "enum_item" | "enum_start" | "enum_end";
  data: SummaryEntity | string;
}

export interface SummaryEntity {
  uuid: string;
  name: string;
  url: string;
  text: string;
  images: SummaryImage[];
  highlight: TextLocation[];
}

export interface SummaryImage extends Image {
  text: string;
}

export interface SummaryEnrichments {
  raw: string;
  images: SummaryImage[];
  qa: SummaryAnswer[];
  entities: SummaryEntity[];
  context: SummaryContext[];
}

export interface SummaryAnswer {
  answer: string;
  score: number;
  highlight: TextLocation;
}

export interface SummaryContext {
  title: string;
  url: string;
  meta_url: MetaUrl;
}

export interface SummaryEntityInfo {
  provider: string;
  description: string;
}

export interface TextLocation {
  start: number;
  end: number;
}

// Additional types that might be useful

export interface Language {
  main: string;
  // Add any other properties related to language if needed
}

export interface DeepResult {
  news?: NewsResult[];
  buttons?: ButtonResult[];
  social?: KnowledgeGraphProfile[];
  videos?: VideoResult[];
  images?: Image[];
}

export interface ButtonResult {
  type: "button_result";
  title: string;
  url: string;
}

export interface KnowledgeGraphProfile {
  title: string;
  description: string;
  url: string;
  thumbnail: string;
}

export interface Image {
  thumbnail: Thumbnail;
  url: string;
  properties: ImageProperties;
}

export interface ImageProperties {
  url: string;
  resized: string;
  height: number;
  width: number;
  format: string;
  content_size: string;
}

// Utility types

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Nullable<T> = { [K in keyof T]: T[K] | null };

// You can add more utility types as needed

// Enums

export enum SafeSearchLevel {
  Off = "off",
  Moderate = "moderate",
  Strict = "strict",
}

export enum FreshnessOption {
  PastDay = "pd",
  PastWeek = "pw",
  PastMonth = "pm",
  PastYear = "py",
}

export enum UnitSystem {
  Metric = "metric",
  Imperial = "imperial",
}
