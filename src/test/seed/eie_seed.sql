-- Seed published EIE concept for integration tests (run manually against dev DB)
INSERT INTO eie_published_knowledge (
  slug,
  concept_name,
  category,
  tags,
  summary,
  practical_explanation,
  best_practices,
  trade_offs,
  alternative_approaches,
  security_considerations,
  common_mistakes,
  implementation_recommendations,
  references,
  views_count
) VALUES (
  'role-based-access-control',
  'Role-Based Access Control',
  'security_compliance',
  ARRAY['security', 'rbac'],
  'Assign permissions to roles instead of individual users.',
  'Define roles that map to permission sets and assign users to roles.',
  '["Use least-privilege defaults"]'::jsonb,
  '["More roles increase maintenance overhead"]'::jsonb,
  '["Attribute-based access control (ABAC)"]'::jsonb,
  '["Audit role changes"]'::jsonb,
  '["Hardcoding role checks in UI only"]'::jsonb,
  '{"middleware":"Check role on every protected route"}'::jsonb,
  '[]'::jsonb,
  0
) ON CONFLICT (slug) DO NOTHING;
