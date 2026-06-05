-- PostgreSQL default: CREATE FUNCTION grants EXECUTE to PUBLIC.
-- REVOKE FROM anon only removes an explicit anon grant — anon still inherits via PUBLIC.
-- Must also REVOKE FROM PUBLIC to fully close anonymous access.
REVOKE EXECUTE ON FUNCTION public.approve_payable(uuid, text)                         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_create_csat()                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_payroll_period(uuid)                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_employee_matricula(uuid)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_aging_report(uuid)                              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_caller_client_id()                              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cashflow_projection(uuid, integer)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_employees_with_expiring_certs(uuid, integer)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_id()                                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pay_payable(uuid, uuid)                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.payable_from_material()                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.payable_from_reimbursement()                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_attachments(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_checklist_items(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_client_locations(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_clients(uuid, integer, integer)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_equipments(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_materials(uuid, integer, integer)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_notifications(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_orcamentos(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_reimbursement_history(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_reimbursements(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_report_status_history(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_reports(uuid, integer, integer)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_signatures(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_all_status_history(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_diagnostic_corpus(uuid, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_intelligence_stats()                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_get_kb_corpus(uuid, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.platform_log_export(text, uuid, integer)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_payable(uuid, text)                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_payable(uuid)                                FROM PUBLIC;

-- Trigger functions: revoke from authenticated (called by DB mechanism, not users)
REVOKE EXECUTE ON FUNCTION public.log_payable_status_change()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_payable_status_change()    FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_payable_updated_by()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_payable_updated_by()       FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_reimbursement_updated_by() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_reimbursement_updated_by() FROM authenticated;
